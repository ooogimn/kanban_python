import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { marketingApi } from '../api/marketing';

function stripOuterScriptTag(raw: string): string {
  const text = (raw || '').trim();
  if (!text) return '';
  const m = text.match(/^<script[^>]*>([\s\S]*?)<\/script>$/i);
  return m ? (m[1] || '').trim() : text;
}

function mountHtmlTo(target: HTMLElement, html: string, marker: string): () => void {
  const source = (html || '').trim();
  if (!source) return () => {};

  const tmp = document.createElement('div');
  tmp.innerHTML = source;
  const inserted: Node[] = [];

  Array.from(tmp.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && !(node.textContent || '').trim()) return;

    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === 'script') {
      const srcScript = node as HTMLScriptElement;
      const script = document.createElement('script');
      Array.from(srcScript.attributes).forEach((a) => script.setAttribute(a.name, a.value));
      script.text = srcScript.text || srcScript.innerHTML || '';
      script.setAttribute('data-runtime-marker', marker);
      target.appendChild(script);
      inserted.push(script);
      return;
    }

    const cloned = node.cloneNode(true) as Node;
    if (cloned instanceof Element) cloned.setAttribute('data-runtime-marker', marker);
    target.appendChild(cloned);
    inserted.push(cloned);
  });

  return () => {
    inserted.forEach((n) => {
      if (n.parentNode === target) target.removeChild(n);
    });
  };
}

export default function PublicIntegrationsHead() {
  const { data } = useQuery({
    queryKey: ['marketing', 'public-settings'],
    queryFn: marketingApi.getPublicSettings,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!data?.custom_head_html) return () => {};
    return mountHtmlTo(document.head, data.custom_head_html, 'custom-head-html');
  }, [data?.custom_head_html]);

  useEffect(() => {
    if (!data?.custom_body_html) return () => {};
    return mountHtmlTo(document.body, data.custom_body_html, 'custom-body-html');
  }, [data?.custom_body_html]);

  if (!data) return null;

  const ymCounter = (data.yandex_metrika_counter_id || '').trim();
  const ymTag = stripOuterScriptTag(data.yandex_metrika_tag || '');
  const gaId = (data.google_analytics_measurement_id || '').trim();
  const gtmId = (data.google_tag_manager_id || '').trim();
  const rsyCode = stripOuterScriptTag(data.yandex_rsy_script || '');

  const generatedYm = ymCounter
    ? `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(k=0;k<document.scripts.length;k++){if(document.scripts[k].src===r){return;}}a=e.createElement(t);a.async=1;a.src=r;e.head.appendChild(a);})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${ymCounter},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});`
    : '';

  const generatedGa = gaId
    ? `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`
    : '';

  const generatedGtm = gtmId
    ? `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`
    : '';

  return (
    <Helmet>
      {data.yandex_webmaster_verification && (
        <meta name="yandex-verification" content={data.yandex_webmaster_verification} />
      )}

      {gaId && <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />}
      {generatedGa && <script>{generatedGa}</script>}
      {generatedGtm && <script>{generatedGtm}</script>}

      {generatedYm && <script>{generatedYm}</script>}
      {ymTag && <script>{ymTag}</script>}
      {rsyCode && <script>{rsyCode}</script>}
    </Helmet>
  );
}
