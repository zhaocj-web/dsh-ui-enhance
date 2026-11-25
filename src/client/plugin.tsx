import React from 'react';
import { ProjectDialog } from './components/ProjectDialog';
import { SettingsSection } from './components/SettingsSection';
import { installCopy } from './features/copy';
import { installFold } from './features/sidebar';
import type { ClientContext } from './types';
import { isZh } from './shared/browser';
import css from './styles.css';
import hoverCss from './hover-actions.css';
import settingsCss from './settings.css';
import { isModuleEnabled, subscribeEnabled } from './shared/settings';
export const name = 'dsh-ui-enhance';
export const inject = [
  'slots',
  'workspaces',
  'uiWorkspace',
  'connection',
  'contextMenus',
  'sessions',
];
/** DOM 增强随插件生命周期清理，避免重新加载时重复注册。 */
export function apply(context: ClientContext): void {
  const style = document.createElement('style');
  style.dataset.plugin = name;
  document.head.appendChild(style);
  let disposeFeatures: (() => void) | undefined;
  const syncEnabled = () => {
    disposeFeatures?.();
    disposeFeatures = undefined;
    style.textContent = settingsCss;
    if (isModuleEnabled('sidebar')) style.textContent += css;
    if (isModuleEnabled('hoverActions')) style.textContent += hoverCss;
    if (isModuleEnabled('hideWorkspaceButton'))
      style.textContent +=
        "[data-slot='sidebar.footer.action'] .mrfw-triggerRow { display: none !important; }";
    const disposeCopy = isModuleEnabled('copy') ? installCopy() : undefined;
    const disposeFold = isModuleEnabled('sidebar') ? installFold() : undefined;
    disposeFeatures = () => {
      disposeCopy?.();
      disposeFold?.();
    };
  };
  syncEnabled();
  const unsubscribe = subscribeEnabled(syncEnabled);
  context.effect(() => () => {
    unsubscribe();
    disposeFeatures?.();
    style.remove();
  });
  const ProjectOverlay = () => <ProjectDialog services={context} width={560} />;
  context.slots.inject('shell.overlay', () =>
    context.slots.register(
      { name: 'shell.overlay', id: `${name}-project`, order: 30 },
      ProjectOverlay,
    ),
  );
  context.slots.inject('settings.section', () =>
    context.slots.register(
      {
        name: 'settings.section',
        id: name,
        order: 30,
        label: () => (isZh() ? '界面增强' : 'UI Enhancements'),
      },
      SettingsSection,
    ),
  );
}
