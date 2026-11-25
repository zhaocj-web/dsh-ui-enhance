import React from 'react';
type ActionButtonProps = {
  label: string;
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  ariaLabel?: string;
  disabled?: boolean;
  primary?: boolean;
};
export function ActionButton(props: ActionButtonProps) {
  return (
    <button
      type={props.type ?? 'button'}
      aria-label={props.ariaLabel}
      className={`${props.primary ? 'due-btn due-btn-primary' : 'due-btn'} ${props.className ?? ''}`}
      onClick={props.onClick}
      disabled={props.disabled ?? false}
    >
      {props.icon}
      {props.label}
    </button>
  );
}
