import { isZh } from '../shared/browser';
import { getEnabled, subscribeEnabled } from '../shared/settings';

type ProjectMenuContribution = {
  id: string;
  target: 'workspace';
  order: number;
  resolve(target: { workspaceId: string }): {
    id: string;
    label: string;
    run(): void;
  }[];
};
export type ProjectMenus = {
  active: { getSnapshot(): { kind: string } | null };
  register(contribution: ProjectMenuContribution): () => void;
};

/** 独立注册编辑入口；增强开启时隐藏多目录插件的原入口。 */
export function installProjectMenu(menus: ProjectMenus, open: (workspaceId: string) => void) {
  const hidden = new Map<HTMLElement, string>();
  let disposeMenu: (() => void) | undefined;
  const restore = () => {
    for (const [item, display] of hidden) item.style.display = display;
    hidden.clear();
  };
  const scan = () => {
    if (!getEnabled() || menus.active.getSnapshot()?.kind !== 'workspace') return;
    for (const item of hidden.keys()) if (!item.isConnected) hidden.delete(item);
    document.querySelectorAll<HTMLElement>('[role="menuitem"]').forEach((item) => {
      if (
        !['管理工作区目录…', '管理工作区目录...', 'Manage workspace folders…'].includes(
          item.textContent?.trim() ?? '',
        ) ||
        hidden.has(item)
      )
        return;
      hidden.set(item, item.style.display);
      item.style.display = 'none';
    });
  };
  const sync = () => {
    disposeMenu?.();
    disposeMenu = undefined;
    restore();
    if (!getEnabled()) return;
    disposeMenu = menus.register({
      id: 'dsh-ui-enhance.edit-project',
      target: 'workspace',
      order: 150,
      resolve: (target) => [
        {
          id: 'edit',
          label: isZh() ? '编辑' : 'Edit',
          run: () => open(target.workspaceId),
        },
      ],
    });
    scan();
  };
  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  const unsubscribe = subscribeEnabled(sync);
  sync();
  return () => {
    observer.disconnect();
    unsubscribe();
    disposeMenu?.();
    restore();
  };
}
