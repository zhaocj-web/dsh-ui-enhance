import React from 'react';
import { FOLDER_APPS } from '../services/folder-open';
import type { FolderApp } from '../services/folder-open';

export type FolderOpenTarget = { path: string; x: number; y: number };
type FolderOpenMenuProps = {
  target: FolderOpenTarget;
  apps: string[];
  onClose(): void;
  onSelect(path: string, app: FolderApp): void;
};

export function FolderOpenMenu(props: FolderOpenMenuProps) {
  const menu = React.useRef<HTMLDivElement>(null);
  const close = React.useRef(props.onClose);
  close.current = props.onClose;
  React.useLayoutEffect(() => {
    const element = menu.current;
    if (!element) return;
    const trigger = document.activeElement;
    element.setAttribute('popover', 'auto');
    const toggled = (event: Event) => {
      if ((event as ToggleEvent).newState === 'closed') close.current();
    };
    element.addEventListener('toggle', toggled);
    element.showPopover();
    const rect = element.getBoundingClientRect();
    element.style.left = `${Math.max(8, Math.min(props.target.x - rect.width, window.innerWidth - rect.width - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(props.target.y, window.innerHeight - rect.height - 8))}px`;
    element.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      element.removeEventListener('toggle', toggled);
      element.hidePopover();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [props.target]);
  return (
    <div
      ref={menu}
      role="menu"
      aria-label="在应用中打开文件夹"
      className="due-folder-app-menu"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          props.onClose();
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
          const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) %
                  buttons.length;
          buttons[next]?.focus();
        } else if (event.key === 'Tab') props.onClose();
      }}
    >
      {FOLDER_APPS.filter((app) => props.apps.includes(app.id)).map((app) => (
        <button
          type="button"
          role="menuitem"
          key={app.id}
          onClick={() => {
            props.onClose();
            props.onSelect(props.target.path, app.id);
          }}
        >
          <img
            src={`open-in-app/icon/${app.id}`}
            width={18}
            height={18}
            alt=""
            draggable={false}
            onError={(event) => {
              event.currentTarget.style.visibility = 'hidden';
            }}
          />
          <span>{app.label}</span>
        </button>
      ))}
    </div>
  );
}
