import React from 'react';
import { isZh } from '../shared/browser';
import { DEFAULTS, getRules, parseRules, saveRules, serializeRules } from '../features/copy';
import { FormItem, Textarea } from './Form';
const buttonStyle: React.CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary)',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 12,
  cursor: 'pointer',
};
export function TitlesRow() {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [error, setError] = React.useState('');
  const [count, setCount] = React.useState(Object.keys(getRules()).length);
  const zh = isZh();
  const close = () => {
    setEditing(false);
    setError('');
  };
  const open = () => {
    setDraft(serializeRules(getRules()));
    setError('');
    setEditing(true);
  };
  const save = () => {
    const next = parseRules(draft);
    if (next === null) {
      setError(
        zh
          ? '格式不对：每行一条「原文 => 新文」'
          : 'Invalid format: one "from => to" rule per line',
      );
      return;
    }
    saveRules(next);
    setCount(Object.keys(next).length);
    setEditing(false);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 14, color: 'var(--dsw-alias-label-primary)' }}>
            {zh ? '界面文案替换' : 'UI copy overrides'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--dsw-alias-label-secondary)' }}>
            {zh ? `${count} 条规则 · 仅中文界面生效` : `${count} rule(s) · Chinese UI only`}
          </span>
        </div>
        <button type="button" style={buttonStyle} onClick={editing ? close : open}>
          {zh ? (editing ? '收起' : '编辑') : editing ? 'Close' : 'Edit'}
        </button>
      </div>
      {editing && (
        <>
          <FormItem
            label={zh ? '替换规则' : 'Replacement rules'}
            error={error}
            help={
              zh
                ? '每行一条：原文 => 新文；清空则不做任何替换。'
                : 'One "from => to" rule per line; empty removes every override.'
            }
          >
            <Textarea
              value={draft}
              spellCheck={false}
              placeholder="工作区 => 项目"
              onChange={(event) => setDraft(event.target.value)}
            />
          </FormItem>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              style={{ ...buttonStyle, background: 'var(--dsw-alias-bg-layer-2)', fontWeight: 600 }}
              onClick={save}
            >
              {zh ? '保存' : 'Save'}
            </button>
            <button type="button" style={buttonStyle} onClick={close}>
              {zh ? '取消' : 'Cancel'}
            </button>
            <button
              type="button"
              style={buttonStyle}
              onClick={() => setDraft(serializeRules(DEFAULTS))}
            >
              {zh ? '恢复默认' : 'Reset'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
