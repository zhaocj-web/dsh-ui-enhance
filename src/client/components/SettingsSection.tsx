import React from 'react';
import { TitlesRow } from './TitlesRow';
import { isZh } from '../shared/browser';
import {
  getEnabled,
  setEnabled,
  subscribeEnabled,
  getModules,
  setModuleEnabled,
} from '../shared/settings';
import type { EnhancementModule } from '../shared/settings';

type ModuleSetting = {
  key: EnhancementModule;
  title: [string, string];
  help: [string, string];
};
const MODULE_SETTINGS: ModuleSetting[] = [
  {
    key: 'copy',
    title: ['界面文案替换', 'UI copy overrides'],
    help: ['按自定义规则替换中文界面文案。', 'Apply custom replacement rules to Chinese UI copy.'],
  },
  {
    key: 'sidebar',
    title: ['侧边栏折叠与新建会话', 'Sidebar folding and new session'],
    help: [
      '折叠项目和会话分组，并在会话标题旁显示新建按钮。',
      'Fold project and session groups and add a new-session button.',
    ],
  },
  {
    key: 'hoverActions',
    title: ['悬停按钮样式', 'Hover actions'],
    help: [
      '悬停或聚焦标题行时显示右侧按钮，取消按钮单独的悬停底色。',
      'Show header actions on hover or focus without individual hover backgrounds.',
    ],
  },
  {
    key: 'projects',
    title: ['项目创建与编辑', 'Project creation and editing'],
    help: [
      '使用增强弹窗创建和编辑项目，关闭后恢复原生入口。',
      'Use the enhanced project dialog; disable to restore native actions.',
    ],
  },
  {
    key: 'folderOpen',
    title: ['文件夹打开方式', 'Open folders in apps'],
    help: [
      '在项目弹窗中显示分享图标，选择 Finder、编辑器或终端打开。需启用项目创建与编辑。',
      'Choose Finder, an editor or a terminal from the share icon. Requires project creation and editing.',
    ],
  },
  {
    key: 'hideWorkspaceButton',
    title: ['隐藏工作区目录按钮', 'Hide workspace folders button'],
    help: [
      '隐藏侧边栏左下角的工作区目录入口。',
      'Hide the workspace folders action at the bottom of the sidebar.',
    ],
  },
];

export function SettingsSection() {
  const enabled = React.useSyncExternalStore(subscribeEnabled, getEnabled);
  const modules = React.useSyncExternalStore(subscribeEnabled, getModules);
  const language = isZh() ? 0 : 1;
  return (
    <div className="due-ui">
      <label className="due-enable-row">
        <span>
          <span className="due-enable-title">
            {language === 0 ? '启用界面增强' : 'Enable UI enhancements'}
          </span>
          <span className="due-enable-help">
            {language === 0
              ? '统一控制所有增强功能；关闭后保留各模块设置。修改立即生效。'
              : 'Controls all enhancements while preserving individual preferences. Changes apply immediately.'}
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
      {MODULE_SETTINGS.map((module) => (
        <label className="due-enable-row" key={module.key}>
          <span>
            <span className="due-enable-title">{module.title[language]}</span>
            <span className="due-enable-help">{module.help[language]}</span>
          </span>
          <input
            className="due-switch"
            type="checkbox"
            role="switch"
            checked={modules[module.key]}
            disabled={!enabled || (module.key === 'folderOpen' && !modules.projects)}
            onChange={(event) => setModuleEnabled(module.key, event.target.checked)}
          />
        </label>
      ))}
      {enabled && modules.copy && <TitlesRow />}
    </div>
  );
}
