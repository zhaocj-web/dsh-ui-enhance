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
