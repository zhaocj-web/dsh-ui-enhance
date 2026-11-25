export const FOLDER_APPS = [
  { id: 'finder', label: 'Finder' },
  { id: 'vscode', label: 'VS Code' },
  { id: 'xcode', label: 'Xcode' },
  { id: 'androidstudio', label: 'Android Studio' },
  { id: 'intellij', label: 'IntelliJ IDEA' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'windsurf', label: 'Windsurf' },
  { id: 'zed', label: 'Zed' },
  { id: 'webstorm', label: 'WebStorm' },
  { id: 'pycharm', label: 'PyCharm' },
  { id: 'terminal', label: '终端' },
  { id: 'iterm2', label: 'iTerm2' },
  { id: 'ghostty', label: 'Ghostty' },
] as const;
export type FolderApp = (typeof FOLDER_APPS)[number]['id'];

export async function folderApplications(signal: AbortSignal): Promise<string[]> {
  const response = await fetch('open-in-app/apps', {
    headers: { accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error('无法获取文件夹打开方式');
  const payload = await response.json();
  if (!Array.isArray(payload.apps)) throw new Error('文件夹打开方式返回格式不正确');
  return payload.apps.filter((id: unknown): id is string => typeof id === 'string');
}

export async function openFolder(path: string, app: FolderApp): Promise<void> {
  const application = FOLDER_APPS.find((item) => item.id === app);
  if (!application) throw new Error('不支持的文件夹打开方式');
  const response = await fetch('open-in-app/open', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ app, path }),
  });
  if (!response.ok)
    throw new Error(`无法使用 ${application.label} 打开文件夹，请确认应用和目录可用`);
}
