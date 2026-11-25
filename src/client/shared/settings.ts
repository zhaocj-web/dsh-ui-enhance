const ENABLED_KEY = 'dsh-ui-enhance:enabled';
const listeners = new Set<() => void>();

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== '0';
  } catch {
    return true;
  }
}

let enabled = loadEnabled();
export const getEnabled = () => enabled;
export function subscribeEnabled(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setEnabled(value: boolean) {
  if (enabled === value) return;
  enabled = value;
  try {
    localStorage.setItem(ENABLED_KEY, value ? '1' : '0');
  } catch {
    // 存储不可用时仍在当前页面生效。
  }
  listeners.forEach((listener) => listener());
}

const MODULES_KEY = 'dsh-ui-enhance:modules';
const DEFAULT_MODULES = {
  copy: true,
  sidebar: true,
  hoverActions: true,
  projects: true,
  folderOpen: true,
  hideWorkspaceButton: true,
};
export type EnhancementModule = keyof typeof DEFAULT_MODULES;
function loadModules(): typeof DEFAULT_MODULES {
  const result = { ...DEFAULT_MODULES };
  try {
    const saved = JSON.parse(localStorage.getItem(MODULES_KEY) ?? '{}');
    for (const key of Object.keys(result) as EnhancementModule[]) {
      if (typeof saved?.[key] === 'boolean') result[key] = saved[key];
    }
  } catch {
    /* 无效或不可用的存储使用默认设置。 */
  }
  return result;
}
let modules = loadModules();
export const getModules = () => modules;
export function isModuleEnabled(key: EnhancementModule): boolean {
  return enabled && modules[key] && (key !== 'folderOpen' || modules.projects);
}
export function setModuleEnabled(key: EnhancementModule, value: boolean) {
  if (modules[key] === value) return;
  modules = { ...modules, [key]: value };
  try {
    localStorage.setItem(MODULES_KEY, JSON.stringify(modules));
  } catch {
    /* 本次会话中仍然生效。 */
  }
  listeners.forEach((listener) => listener());
}
