import React from 'react';

type DialogHeaderProps = {
  children: React.ReactNode;
  actions?: React.ReactNode;
  closeLabel?: string;
  closeDisabled?: boolean;
  onClose: () => void;
};

/** 共用设置弹窗的标题栏；关闭仍交由原生 dialog 管理焦点和 Escape。 */
export function DialogHeader(props: DialogHeaderProps) {
  return (
    <header className="due-dialog-header">
      <div className="due-dialog-title">{props.children}</div>
      <div className="due-dialog-header-actions">
        {props.actions}
        <button
          type="button"
          className="due-settings-trigger"
          aria-label={props.closeLabel ?? '关闭弹窗'}
          disabled={props.closeDisabled}
          onClick={props.onClose}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </header>
  );
}
