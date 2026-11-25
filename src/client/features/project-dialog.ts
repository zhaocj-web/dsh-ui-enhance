import { isModuleEnabled } from '../shared/settings';

/** 只接管项目标题工具栏末尾的新增按钮，不拦截搜索和视图菜单。 */
export function installProjectDialog(open: () => void) {
  const onClick = (event: MouseEvent) => {
    if (!isModuleEnabled('projects') || !(event.target instanceof Element)) return;
    const button = event.target.closest('button');
    const actions = button?.closest('[data-sidebar-workspace-header] [class*="headerActions"]');
    if (!button || !actions) return;
    const buttons = actions.querySelectorAll('button');
    if (
      buttons.length === 0 ||
      buttons[buttons.length - 1] !== button ||
      !button.className.includes('iconButton') ||
      button.className.split(/\s+/).some((name) => name.endsWith('_wide'))
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open();
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}
