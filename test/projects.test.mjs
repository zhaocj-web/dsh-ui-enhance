import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/client/services/projects.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { createProject, validateProject, loadProject, updateProject } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
);

const sessions = {
  using: async (id, options, operation) =>
    operation({ binding: { session: { getSnapshot: () => ({ openState: 'open' }) } } }),
  list: { getSnapshot: () => ({ byId: { s: { agentAvailable: true } } }) },
};

test('项目名称和源文件夹必须有效', () => {
  assert.throws(() => validateProject({ title: ' ', paths: ['/a'] }), /名称/);
  assert.throws(() => validateProject({ title: '示例', paths: [] }), /至少/);
  assert.throws(() => validateProject({ title: '示例', paths: ['/a', '/a'] }), /重复/);
});

test('多目录创建失败后只重试未完成的目录', async () => {
  const events = [];
  let fail = true;
  const services = {
    sessions,
    workspaces: {
      list: { getSnapshot: () => ({ items: [] }) },
      create: async (input) => {
        events.push(['create', input]);
        return { workspaceId: 'project' };
      },
      rename: async (id, title) => {
        events.push(['rename', id, title]);
      },
    },
    uiWorkspace: {
      openWorkspace: async (id, callback) => {
        events.push(['open', id]);
        callback('session');
      },
    },
    connection: {
      rpc: {
        call: async (channel, endpoint, payload) => {
          events.push(['root', channel, endpoint, payload]);
          if (payload.path === '/c' && fail) return { ok: false, error: { message: '暂时失败' } };
          return { ok: true };
        },
      },
    },
  };
  const progress = { added: [] };
  const draft = { title: ' 示例项目 ', paths: ['/a', '/b', '/c'] };
  await assert.rejects(createProject(services, draft, progress), /\/c.*暂时失败/);
  assert.deepEqual(progress.added, ['/b']);
  fail = false;
  await createProject(services, draft, progress);
  assert.deepEqual(progress.added, ['/b', '/c']);
  assert.equal(events.filter((item) => item[0] === 'create').length, 1);
  assert.equal(events.filter((item) => item[0] === 'rename').length, 1);
  assert.equal(events.filter((item) => item[0] === 'open').length, 1);
  assert.deepEqual(events[1], ['rename', 'project', '示例项目']);
  assert.deepEqual(events[3], [
    'root',
    '/multi-root-workspace',
    'add',
    { sessionId: 'session', path: '/b', access: 'inherit' },
  ]);
});

test('已有源目录不会重命名或修改现有项目', async () => {
  const services = {
    sessions,
    workspaces: {
      list: { getSnapshot: () => ({ items: [{ path: '/a' }] }) },
      create: () => assert.fail('不应创建'),
    },
  };
  await assert.rejects(
    createProject(services, { title: '新项目', paths: ['/a'] }, { added: [] }),
    /现有项目/,
  );
});

test('修改读取指定项目，保存目录差异并保留其他窗口新增目录', async () => {
  const workspace = { workspaceId: 'p', title: '旧名称', path: '/main', sessionIds: ['s'] };
  const old = { ordinal: 1, id: 'old', path: '/old', addedAt: 'one' };
  const concurrent = { ordinal: 2, id: 'other', path: '/other', addedAt: 'two' };
  let roots = [old];
  const calls = [];
  const services = {
    sessions,
    workspaces: {
      list: { getSnapshot: () => ({ items: [workspace] }) },
      rename: async (...args) => calls.push(['rename', ...args]),
    },
    uiWorkspace: {
      openWorkspace: () => assert.fail('修改项目不应创建或切换会话'),
    },
    connection: {
      rpc: {
        call: async (channel, endpoint, payload) => {
          calls.push([endpoint, payload]);
          return { ok: true, value: { primaryRoot: '/main', roots } };
        },
      },
    },
  };
  const loaded = await loadProject(services, 'p');
  assert.deepEqual(loaded.draft, { title: '旧名称', paths: ['/main', '/old'] });
  roots = [old, concurrent];
  await updateProject(services, loaded.edit, { title: '新名称', paths: ['/main', '/new'] });
  assert.deepEqual(
    calls.filter((c) => c[0] === 'remove'),
    [['remove', { sessionId: 's', entry: old }]],
  );
  assert.deepEqual(
    calls.find((c) => c[0] === 'add'),
    ['add', { sessionId: 's', path: '/new', access: 'inherit' }],
  );
  assert.deepEqual(calls.at(-1), ['rename', 'p', '新名称']);
  await assert.rejects(
    updateProject(services, loaded.edit, { title: '新名称', paths: ['/different'] }),
    /主目录/,
  );
});

test('创建名称为空时使用当前主要文件夹名称，自定义名称优先', async () => {
  for (const [title, path, expected] of [
    ['', '/projects/main-app', 'main-app'],
    ['   ', '/projects/other-app/', 'other-app'],
    ['', 'C:\\projects\\desktop', 'desktop'],
    [' 自定义 ', '/projects/main-app', '自定义'],
  ]) {
    let actual;
    const services = {
      sessions,
      workspaces: {
        list: { getSnapshot: () => ({ items: [] }) },
        create: async () => ({ workspaceId: 'p' }),
        rename: async (id, value) => {
          actual = value;
        },
      },
      uiWorkspace: { openWorkspace: async (id, cb) => cb('s') },
    };
    await createProject(services, { title, paths: [path] }, { added: [] });
    assert.equal(actual, expected);
  }
});

test('修改时清空名称，与创建一样使用主要文件夹名称', async () => {
  const names = [];
  const edit = {
    workspace: { workspaceId: 'p', title: '原名称', path: '/projects/main-app' },
    sessionId: 's',
    originalPaths: [],
  };
  const services = {
    sessions,
    workspaces: { rename: async (id, title) => names.push(title) },
    connection: {
      rpc: {
        call: async () => ({ ok: true, value: { primaryRoot: '/projects/main-app', roots: [] } }),
      },
    },
  };
  await updateProject(services, edit, { title: '  ', paths: ['/projects/main-app'] });
  assert.deepEqual(names, ['main-app']);
  assert.equal(edit.workspace.title, 'main-app');
});

test('无会话项目打开及仅修改名称不创建会话', async () => {
  const workspace = { workspaceId: 'empty', title: '旧名称', path: '/empty', sessionIds: [] };
  const services = {
    sessions,
    workspaces: {
      list: { getSnapshot: () => ({ items: [workspace] }) },
      rename: async () => {},
    },
    uiWorkspace: { openWorkspace: () => assert.fail('不应创建或切换会话') },
    connection: { rpc: { call: () => assert.fail('无会话时不请求目录接口') } },
  };
  const loaded = await loadProject(services, 'empty');
  assert.deepEqual(loaded.draft.paths, ['/empty']);
  await updateProject(services, loaded.edit, { title: '新名称', paths: ['/empty'] });
});

test('编辑冷会话只重试未激活的读取，其他失败立即释放引用', async () => {
  for (const fail of [false, true]) {
    let held = false;
    let reads = 0;
    let released = false;
    const services = {
      sessions: {
        using: async (id, options, operation) => {
          assert.equal(id, 'cold');
          held = true;
          try {
            return await operation({
              binding: { session: { getSnapshot: () => ({ openState: 'open' }) } },
            });
          } finally {
            held = false;
            released = true;
          }
        },
      },
      workspaces: {
        list: {
          getSnapshot: () => ({
            items: [{ workspaceId: 'p', title: '项目', path: '/main', sessionIds: ['cold'] }],
          }),
        },
      },
      uiWorkspace: { openWorkspace: () => assert.fail('不创建或切换会话') },
      connection: {
        rpc: {
          call: async (channel, endpoint) => {
            assert.equal(held, true);
            assert.equal(endpoint, 'list');
            reads++;
            if (fail) return { ok: false, error: { code: 'denied', message: '读取失败' } };
            if (reads === 1) return { ok: false, error: { code: 'session-not-live' } };
            return { ok: true, value: { primaryRoot: '/main', roots: [] } };
          },
        },
      },
    };
    const pending = loadProject(services, 'p');
    if (fail) await assert.rejects(pending, /读取失败/);
    else await pending;
    assert.equal(reads, fail ? 1 : 2);
    assert.equal(released, true);
  }
});
