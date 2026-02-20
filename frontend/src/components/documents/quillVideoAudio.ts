/**
 * Регистрация кастомных блоков Quill для видео и аудио (сохраняются в HTML).
 */
import Quill from 'quill';

const BlockEmbed = Quill.import('blots/block/embed');

class VideoBlot extends BlockEmbed {
  static blotName = 'video';
  static tagName = 'div';
  static className = 'ql-video-embed';

  static match(node: HTMLElement) {
    return node.tagName === 'DIV' && node.classList.contains('ql-video-embed');
  }

  static create(value: string) {
    const node = super.create(value) as HTMLElement;
    node.setAttribute('contenteditable', 'false');
    const isYouTube = /youtube\.com|youtu\.be/i.test(value);
    const isVimeo = /vimeo\.com/i.test(value);
    if (isYouTube) {
      let embedUrl = value;
      if (value.includes('youtube.com/watch?')) {
        const match = value.match(/v=([^&]+)/);
        embedUrl = match ? `https://www.youtube.com/embed/${match[1]}` : value;
      } else if (value.includes('youtu.be/')) {
        const id = value.split('youtu.be/')[1]?.split('?')[0] || '';
        embedUrl = `https://www.youtube.com/embed/${id}`;
      }
      node.innerHTML = `<iframe width="560" height="315" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;
    } else if (isVimeo) {
      const match = value.match(/vimeo\.com\/(\d+)/);
      const id = match ? match[1] : value.split('/').pop() || '';
      node.innerHTML = `<iframe width="560" height="315" src="https://player.vimeo.com/video/${id}" frameborder="0" allowfullscreen></iframe>`;
    } else {
      node.innerHTML = `<video src="${value}" controls width="100%" style="max-width:560px;"></video>`;
    }
    return node;
  }

  static value(node: HTMLElement) {
    const iframe = node.querySelector('iframe');
    const video = node.querySelector('video');
    if (iframe) return iframe.src;
    if (video) return (video as HTMLVideoElement).src;
    return '';
  }
}

class AudioBlot extends BlockEmbed {
  static blotName = 'audio';
  static tagName = 'div';
  static className = 'ql-audio-embed';

  static match(node: HTMLElement) {
    return node.tagName === 'DIV' && node.classList.contains('ql-audio-embed');
  }

  static create(value: string) {
    const node = super.create(value) as HTMLElement;
    node.setAttribute('contenteditable', 'false');
    node.innerHTML = `<audio src="${value}" controls style="width:100%; max-width:560px;"></audio>`;
    return node;
  }

  static value(node: HTMLElement) {
    const audio = node.querySelector('audio');
    return audio ? (audio as HTMLAudioElement).src : '';
  }
}

Quill.register(VideoBlot);
Quill.register(AudioBlot);

export { VideoBlot, AudioBlot };
