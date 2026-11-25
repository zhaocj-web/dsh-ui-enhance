import React from 'react';
import { TitlesRow } from './TitlesRow';
import { isZh } from '../shared/browser';
import { getEnabled, setEnabled, subscribeEnabled } from '../shared/settings';

export function SettingsSection() {
  const enabled = React.useSyncExternalStore(subscribeEnabled, getEnabled);
  const zh = isZh();
  return (
    <div className="due-ui">
      <label className="due-enable-row">
        <span>
          <span className="due-enable-title">{zh ? '启用界面增强' : 'Enable UI enhancements'}</span>
          <span className="due-enable-help">
            {zh
              ? '统一控制文案替换、侧边栏折叠和按钮样式，修改后立即生效。'
              : 'Controls copy overrides, sidebar folding and button styles. Changes apply immediately.'}
          </span>
        </span>
        <input
          className="due-switch"
          type="checkbox"
          role="switch"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
      </label>
      <TitlesRow />
    </div>
  );
}
