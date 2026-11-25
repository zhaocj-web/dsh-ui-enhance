export type Workspace = { workspaceId: string; path: string; title: string; sessionIds: string[] };
export type ProjectServices = {
  contextMenus: import('../features/project-menu').ProjectMenus;
  sessions: {
    using<T>(
      id: string,
      options: { source: string },
      operation: (reference: {
        binding: { session: { getSnapshot(): { openState: string; openError?: Error } } };
      }) => Promise<T>,
    ): Promise<T>;
  };
  workspaces: {
    list: { getSnapshot(): { items: Workspace[] } };
    create(input: { path: string }): Promise<Workspace>;
    rename(id: string, title: string): Promise<Workspace>;
  };
  uiWorkspace: {
    pickDirectory(): Promise<string | null>;
    openWorkspace(id: string, beforeOpen: (sessionId: string) => void): Promise<void>;
  };
  connection: {
    rpc: {
      call(
        channel: string,
        endpoint: string,
        payload: Record<string, unknown>,
      ): Promise<{ ok: boolean; error?: { code?: string; message: string }; value?: unknown }>;
    };
  };
};
export type ProjectDraft = { title: string; paths: string[] };
export type ProjectProgress = {
  workspaceId?: string;
  renamed?: boolean;
  sessionId?: string;
  added: string[];
};

export function validateProject(draft: ProjectDraft): void {
  if (!draft.title.trim()) throw new Error('请输入项目名称');
  if (!draft.paths.length) throw new Error('请至少选择一个源文件夹');
  if (new Set(draft.paths).size !== draft.paths.length) throw new Error('源文件夹不能重复');
  for (const path of draft.paths) {
    if (!path.trim()) throw new Error('源文件夹不能为空');
  }
}

function projectTitle(draft: ProjectDraft): string {
  const title =
    draft.title.trim() ||
    draft.paths[0]?.split(/[\\/]/).filter(Boolean).at(-1) ||
    draft.paths[0] ||
    '';
  return title;
}

/** 记录已完成步骤，失败重试不重复创建项目或添加已成功的目录。 */
export async function createProject(
  services: ProjectServices,
  draft: ProjectDraft,
  progress: ProjectProgress,
) {
  const title = projectTitle(draft);
  validateProject({ ...draft, title });
  if (!progress.workspaceId) {
    const exists = services.workspaces.list
      .getSnapshot()
      .items.some((item) => item.path === draft.paths[0]);
    if (exists) throw new Error('第一个源文件夹已属于现有项目，请选择其他目录');
    const workspace = await services.workspaces.create({ path: draft.paths[0] });
    progress.workspaceId = workspace.workspaceId;
  }
  if (!progress.renamed) {
    await services.workspaces.rename(progress.workspaceId, title);
    progress.renamed = true;
  }
  if (!progress.sessionId) {
    await services.uiWorkspace.openWorkspace(progress.workspaceId, (id) => {
      progress.sessionId = id;
    });
    if (!progress.sessionId) throw new Error('项目已创建，但未能打开项目，请重试');
  }
  for (const path of draft.paths.slice(1)) {
    if (progress.added.includes(path)) continue;
    const result = await services.connection.rpc.call('/multi-root-workspace', 'add', {
      sessionId: progress.sessionId,
      path,
      access: 'inherit',
    });
    if (!result.ok)
      throw new Error(
        `源文件夹 ${path} 添加失败：${result.error?.message ?? '请确认多目录插件已启用'}`,
      );
    progress.added.push(path);
  }
}

export type ProjectEdit = { workspace: Workspace; sessionId?: string; originalPaths: string[] };
type RootEntry = { ordinal: number; id: string; path: string; addedAt: string };
type RootsView = { primaryRoot: string; roots: RootEntry[] };

async function rootRequest(
  services: ProjectServices,
  endpoint: string,
  payload: Record<string, unknown>,
) {
  const sessionId = payload.sessionId;
  if (typeof sessionId !== 'string') throw new Error('缺少项目会话');
  return services.sessions.using(sessionId, { source: 'projectEditor' }, async (reference) => {
    const state = reference.binding.session.getSnapshot();
    if (state.openState !== 'open') throw state.openError ?? new Error('项目会话加载失败');
    // Client 会话列表不暴露 Host 激活状态，用只读目录请求确认就绪。
    const ready = await readWhenActive(services, sessionId);
    if (endpoint === 'list') return ready;
    const result = await services.connection.rpc.call('/multi-root-workspace', endpoint, payload);
    if (!result.ok) throw new Error(result.error?.message ?? '工作区目录操作失败');
    return result.value;
  });
}

async function readWhenActive(services: ProjectServices, sessionId: string) {
  const deadline = Date.now() + 15000;
  while (true) {
    const result = await services.connection.rpc.call('/multi-root-workspace', 'list', {
      sessionId,
    });
    if (result.ok) return result.value;
    if (result.error?.code !== 'session-not-live')
      throw new Error(result.error?.message ?? '工作区目录读取失败');
    if (Date.now() >= deadline) throw new Error('项目会话恢复超时，请重试');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function readRoots(services: ProjectServices, sessionId: string): Promise<RootsView> {
  const value = await rootRequest(services, 'list', { sessionId });
  if (!value || typeof value !== 'object') throw new Error('工作区目录返回格式不正确');
  const view = value as RootsView;
  if (
    typeof view.primaryRoot !== 'string' ||
    !Array.isArray(view.roots) ||
    view.roots.some(
      (root) =>
        typeof root.path !== 'string' ||
        typeof root.id !== 'string' ||
        typeof root.ordinal !== 'number' ||
        typeof root.addedAt !== 'string',
    )
  )
    throw new Error('工作区目录返回格式不正确');
  return view;
}

export async function loadProject(services: ProjectServices, workspaceId: string) {
  const workspace = services.workspaces.list
    .getSnapshot()
    .items.find((item) => item.workspaceId === workspaceId);
  if (!workspace) throw new Error('项目不存在，请刷新后重试');
  const sessionId = workspace.sessionIds[0];
  const view = sessionId
    ? await readRoots(services, sessionId)
    : { primaryRoot: workspace.path, roots: [] };
  return {
    edit: { workspace, sessionId, originalPaths: view.roots.map((root) => root.path) },
    draft: {
      title: workspace.title,
      paths: [workspace.path, ...view.roots.map((root) => root.path)],
    },
  };
}

/** 每次保存读取最新目录快照；失败重试不会重复添加或误删已变更的条目。 */
export async function updateProject(
  services: ProjectServices,
  edit: ProjectEdit,
  draft: ProjectDraft,
) {
  const title = projectTitle(draft);
  validateProject({ ...draft, title });
  if (draft.paths[0] !== edit.workspace.path) throw new Error('已有项目不能更换主目录');
  const wanted = new Set(draft.paths.slice(1));
  // 空项目仅在保存新增目录时才需要会话；打开、取消和只改名称均不创建。
  if (!edit.sessionId && wanted.size) {
    edit.sessionId = services.workspaces.list
      .getSnapshot()
      .items.find((item) => item.workspaceId === edit.workspace.workspaceId)?.sessionIds[0];
    if (!edit.sessionId) {
      await services.uiWorkspace.openWorkspace(edit.workspace.workspaceId, (id) => {
        edit.sessionId = id;
      });
      if (!edit.sessionId) throw new Error('无法保存源文件夹，请重试');
    }
  }
  const view = edit.sessionId
    ? await readRoots(services, edit.sessionId)
    : { primaryRoot: edit.workspace.path, roots: [] };
  // 先添加成功，再移除用户明确取消的目录，降低部分失败的影响。
  for (const path of wanted) {
    if (!view.roots.some((root) => root.path === path))
      await rootRequest(services, 'add', { sessionId: edit.sessionId, path, access: 'inherit' });
  }
  for (const root of view.roots) {
    if (edit.originalPaths.includes(root.path) && !wanted.has(root.path)) {
      const entry = { ordinal: root.ordinal, id: root.id, path: root.path, addedAt: root.addedAt };
      await rootRequest(services, 'remove', { sessionId: edit.sessionId, entry });
    }
  }
  if (title !== edit.workspace.title) {
    await services.workspaces.rename(edit.workspace.workspaceId, title);
    edit.workspace = { ...edit.workspace, title: title };
  }
}
