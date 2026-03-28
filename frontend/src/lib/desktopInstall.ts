/** Путь на том же домене; nginx отдаёт из desktop-releases (см. deploy/nginx-kanban-frontend-fix.conf) */
export const DEFAULT_WINDOWS_INSTALLER_PATH = '/downloads/AntExpress-Setup.exe';

export function getDesktopInstallerHref(): string {
  const envUrl = import.meta.env.VITE_DESKTOP_DOWNLOAD_URL;
  if (typeof envUrl === 'string' && envUrl.trim() !== '') return envUrl.trim();
  return DEFAULT_WINDOWS_INSTALLER_PATH;
}
