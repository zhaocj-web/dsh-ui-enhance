export const isZh = () => document.documentElement.lang.toLowerCase().startsWith('zh');

export const readFlag = (key: string) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};
export const writeFlag = (key: string, on: boolean) => {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    // Storage may be unavailable; the state still applies for this page.
  }
};
