import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
// 仅验证模块加载契约；组件渲染由 DSH 提供的 React 负责。
const React = { createContext: () => ({}) };

const output = await build({
  entryPoints: ['src/client/features/copy.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const copy = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`
);

test('规则支持注释、空替换、清空以及保存格式往返', () => {
  assert.deepEqual(copy.parseRules('# comment\n工作区 => 项目\n隐藏 =>\n'), {
    工作区: '项目',
    隐藏: '',
  });
  assert.deepEqual(copy.parseRules(''), {});
  assert.equal(copy.parseRules('=> 项目'), null);
  assert.equal(copy.parseRules('工作区 项目'), null);
  const rules = { 工作区: '项目', 提示: '内容 => 结果' };
  assert.deepEqual(copy.parseRules(copy.serializeRules(rules)), rules);
});

test('构建产物通过 DSH 加载器注册并使用宿主 React', async () => {
  const result = await build({
    entryPoints: ['src/client/plugin.tsx'],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'cjs',
    external: ['react'],
    loader: { '.css': 'text' },
  });
  const context = {
    module: { exports: {} },
    exports: null,
    require: (name) => {
      assert.equal(name, 'react');
      return React;
    },
  };
  context.exports = context.module.exports;
  runInNewContext(result.outputFiles[0].text, context);
  assert.equal(context.module.exports.name, 'dsh-ui-enhance');
  assert.equal(typeof context.module.exports.apply, 'function');
  assert.deepEqual(Array.from(context.module.exports.inject), [
    'slots',
    'workspaces',
    'uiWorkspace',
    'connection',
    'contextMenus',
    'sessions',
  ]);
  const manifest = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(manifest.exports['./client'], './lib/client.js');
});

test('总开关默认开启、持久保存，取消订阅后不再通知', async () => {
  const result = await build({
    entryPoints: ['src/client/shared/settings.ts'],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'cjs',
  });
  const values = new Map();
  const load = () => {
    const module = { exports: {} };
    runInNewContext(result.outputFiles[0].text, {
      module,
      exports: module.exports,
      localStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      },
    });
    return module.exports;
  };
  const settings = load();
  assert.equal(settings.getEnabled(), true);
  let changes = 0;
  const unsubscribe = settings.subscribeEnabled(() => {
    changes++;
  });
  settings.setEnabled(false);
  assert.equal(changes, 1);
  assert.equal(load().getEnabled(), false);
  settings.setEnabled(false);
  assert.equal(changes, 1);
  unsubscribe();
  settings.setEnabled(true);
  assert.equal(changes, 1);
  assert.equal(load().getEnabled(), true);
});
