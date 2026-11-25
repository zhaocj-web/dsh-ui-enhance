import { isZh } from '../shared/browser';
import { isModuleEnabled, subscribeEnabled } from '../shared/settings';

export type ProjectMenus = {
  active: { getSnapshot(): { kind: string; value?: { workspaceId?: string } } | null };
  close(): void;
};

type RenameRecord = { original: string; applied: string; item: HTMLElement };

/** 复用项目重命名入口，保留原图标；关闭增强时恢复原菜单。 */
export function installProjectMenu(menus: ProjectMenus, open: (workspaceId: string) => void) {
  const hidden = new Map<HTMLElement, string>();
  const renamed = new Map<Text, RenameRecord>();
  const targets = new Map<HTMLElement, string>();
  const restore = () => {
    for (const [item, display] of hidden) item.style.display = display;
    for (const [node, record] of renamed) {
      if (node.data === record.applied) node.data = record.original;
    }
    hidden.clear();
    renamed.clear();
    targets.clear();
  };
  const scan = () => {
    if (!isModuleEnabled('projects')) return;
    for (const item of hidden.keys()) if (!item.isConnected) hidden.delete(item);
    for (const item of targets.keys()) if (!item.isConnected) targets.delete(item);
    for (const node of renamed.keys()) if (!node.isConnected) renamed.delete(node);
    const target = menus.active.getSnapshot();
    if (target?.kind !== 'workspace' || !target.value?.workspaceId) return;
    const workspaceId = target.value.workspaceId;
    document.querySelectorAll<HTMLElement>('[role="menuitem"]').forEach((item) => {
      if (
        ['管理工作区目录…', '管理工作区目录...', 'Manage workspace folders…'].includes(
          item.textContent?.trim() ?? '',
        ) &&
        !hidden.has(item)
      ) {
        hidden.set(item, item.style.display);
        item.style.display = 'none';
      }
      const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node as Text;
        if (!['重命名', 'Rename'].includes(text.data.trim())) continue;
        const applied = isZh() ? '编辑' : 'Edit';
        renamed.set(text, { original: text.data, applied, item });
        targets.set(item, workspaceId);
        text.data = applied;
      }
    });
  };
  const activate = (event: MouseEvent | KeyboardEvent) => {
    if (!isModuleEnabled('projects') || !(event.target instanceof Element)) return;
    if (event instanceof KeyboardEvent && !['Enter', ' '].includes(event.key)) return;
    const item = event.target.closest<HTMLElement>('[role="menuitem"]');
    if (!item || item.matches(':disabled, [aria-disabled="true"]')) return;
    const workspaceId = targets.get(item);
    if (!workspaceId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    menus.close();
    open(workspaceId);
  };
  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  const unsubscribe = subscribeEnabled(() => {
    restore();
    scan();
  });
  window.addEventListener('click', activate, true);
  window.addEventListener('keydown', activate, true);
  scan();
  return () => {
    observer.disconnect();
    unsubscribe();
    window.removeEventListener('click', activate, true);
    window.removeEventListener('keydown', activate, true);
    restore();
  };
}
