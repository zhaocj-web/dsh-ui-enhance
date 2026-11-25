import React, { createContext, useContext, useId } from 'react';
interface FieldContext {
  id: string;
  descriptionId?: string;
  invalid: boolean;
}
const FormItemContext = createContext<FieldContext | null>(null);
type FormItemProps = {
  label: string;
  grouped?: boolean;
  layout?: 'vertical' | 'inline';
  hideLabel?: boolean;
  help?: string;
  warning?: string;
  error?: string;
  children: React.ReactNode;
};
/** 一个表单项对应一个控件；统一标签、说明、错误和可访问性关联。 */
export function FormItem(props: FormItemProps) {
  const id = useId();
  const message = props.error || props.warning || props.help;
  const descriptionId = message ? `${id}-description` : undefined;
  const messageClassName = props.error
    ? 'due-form-message due-error'
    : props.warning
      ? 'due-form-message due-warning'
      : 'due-form-message';
  return (
    <FormItemContext.Provider value={{ id, descriptionId, invalid: Boolean(props.error) }}>
      <div className={`due-form-item${props.layout === 'inline' ? ' due-form-item-inline' : ''}`}>
        <div className={props.hideLabel ? 'due-visually-hidden' : 'due-form-label-row'}>
          {props.grouped ? (
            <span className="due-label" id={`${id}-label`}>
              {props.label}
            </span>
          ) : (
            <label className="due-label" htmlFor={id}>
              {props.label}
            </label>
          )}
        </div>
        {props.children}
        {descriptionId && (
          <p
            id={descriptionId}
            className={messageClassName}
            role={props.error ? 'alert' : undefined}
          >
            {message}
          </p>
        )}
      </div>
    </FormItemContext.Provider>
  );
}
function useFieldAttributes() {
  const field = useContext(FormItemContext);
  return {
    id: field?.id,
    'aria-describedby': field?.descriptionId,
    'aria-invalid': field?.invalid || undefined,
  };
}
type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'>;
/** 原生事件与属性原样传递，页面只负责业务值，不再拼接控件样式。 */
export function Input(props: InputProps) {
  const field = useFieldAttributes();
  return (
    <input
      {...props}
      {...field}
      type={props.type ?? 'text'}
      className={`due-control due-input ${props.className ?? ''}`}
    />
  );
}
type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>;
export function Textarea(props: TextareaProps) {
  const field = useFieldAttributes();
  return (
    <textarea
      {...props}
      {...field}
      rows={props.rows ?? 4}
      className={`due-control due-textarea ${props.className ?? ''}`}
    />
  );
}
