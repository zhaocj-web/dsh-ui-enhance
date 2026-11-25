import React from 'react';
import { FormItem, Input } from './Form';
import { ActionButton } from './Controls';
import { FolderOpenMenu } from './FolderOpenMenu';
import type { FolderOpenTarget } from './FolderOpenMenu';
import { DialogHeader } from './DialogHeader';
import { createProject, loadProject, updateProject } from '../services/projects';
import type { ProjectServices, ProjectProgress, ProjectEdit } from '../services/projects';
import { installProjectDialog } from '../features/project-dialog';
import { installProjectMenu } from '../features/project-menu';
import { FOLDER_APPS, folderApplications, openFolder } from '../services/folder-open';
import type { FolderApp } from '../services/folder-open';
import { isModuleEnabled, subscribeEnabled } from '../shared/settings';

type FolderIconProps = { add?: boolean };
function FolderIcon(props: FolderIconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d={
          props.add
            ? 'M13 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v3M3 9h18M19 15v6M16 18h6'
            : 'M3 9h18M5 4h5l3 3h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z'
        }
      />
    </svg>
  );
}

type ProjectDialogProps = {
  services: ProjectServices;
  width: number;
};
export function ProjectDialog(props: ProjectDialogProps) {
  const titleId = React.useId();
  const dialog = React.useRef<HTMLDialogElement>(null);
  const trigger = React.useRef<HTMLElement | null>(null);
  const progress = React.useRef<ProjectProgress>({ added: [] });
  const alive = React.useRef(true);
  const busyRef = React.useRef(false);
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [paths, setPaths] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [apps, setApps] = React.useState<string[] | null>(null);
  const [folderMenu, setFolderMenu] = React.useState<FolderOpenTarget | null>(null);
  const [openingFolder, setOpeningFolder] = React.useState(false);
  const openingRef = React.useRef(false);
  const [appError, setAppError] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [edit, setEdit] = React.useState<ProjectEdit | null>(null);
  const enabled = React.useSyncExternalStore(subscribeEnabled, () => isModuleEnabled('projects'));
  const folderOpenEnabled = React.useSyncExternalStore(subscribeEnabled, () =>
    isModuleEnabled('folderOpen'),
  );
  React.useEffect(() => {
    alive.current = true;
    const openDialog = async (workspaceId?: string) => {
      if (busyRef.current) return;
      trigger.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setFolderMenu(null);
      setTitle('');
      setPaths([]);
      setError('');
      setEdit(null);
      setEditing(Boolean(workspaceId));
      progress.current = { added: [] };
      setOpen(true);
      if (!workspaceId) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const result = await loadProject(props.services, workspaceId);
        if (!alive.current) return;
        setTitle(result.draft.title);
        setPaths(result.draft.paths);
        setEdit(result.edit);
      } catch (reason) {
        if (alive.current) setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        busyRef.current = false;
        if (alive.current) setBusy(false);
      }
    };
    const dispose = installProjectDialog(() => {
      void openDialog();
    });
    const disposeMenu = installProjectMenu(props.services.contextMenus, (id) => {
      void openDialog(id);
    });
    return () => {
      alive.current = false;
      dispose();
      disposeMenu();
    };
  }, []);
  React.useEffect(() => {
    if (open && enabled) dialog.current?.showModal();
    else {
      dialog.current?.close();
      if (!enabled) {
        setOpen(false);
        setFolderMenu(null);
      }
    }
  }, [open, enabled]);
  React.useEffect(() => {
    if (!open || !enabled || !folderOpenEnabled) {
      setFolderMenu(null);
      return;
    }
    const controller = new AbortController();
    setApps(null);
    setAppError('');
    void folderApplications(controller.signal).then(
      (available) => {
        if (!controller.signal.aborted) setApps(available);
      },
      (reason) => {
        if (!controller.signal.aborted) {
          setApps([]);
          setAppError(reason instanceof Error ? reason.message : String(reason));
        }
      },
    );
    return () => controller.abort();
  }, [open, enabled, folderOpenEnabled]);
  const launchFolder = async (path: string, app: FolderApp) => {
    if (!isModuleEnabled('folderOpen') || openingRef.current || busyRef.current) return;
    openingRef.current = true;
    setOpeningFolder(true);
    setAppError('');
    try {
      await openFolder(path, app);
    } catch (reason) {
      if (alive.current) setAppError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      openingRef.current = false;
      if (alive.current) setOpeningFolder(false);
    }
  };
  const close = () => {
    if (busyRef.current) return;
    setFolderMenu(null);
    setOpen(false);
    trigger.current?.focus();
  };
  const pick = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const path = await props.services.uiWorkspace.pickDirectory();
      if (alive.current && path)
        setPaths((previous) => (previous.includes(path) ? previous : [...previous, path]));
    } catch (reason) {
      if (alive.current) setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      if (editing) {
        if (!edit) throw new Error('项目尚未加载完成，请关闭后重试');
        await updateProject(props.services, edit, { title, paths });
      } else await createProject(props.services, { title, paths }, progress.current);
      if (alive.current) {
        setOpen(false);
        setTitle('');
        setPaths([]);
        progress.current = { added: [] };
        trigger.current?.focus();
      }
    } catch (reason) {
      if (alive.current) setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const locked = busy || (editing ? !edit : Boolean(progress.current.workspaceId));
  return (
    <dialog
      ref={dialog}
      className="due-ui due-project-dialog"
      style={{ width: props.width }}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <form className="due-project-form" onSubmit={submit} aria-busy={busy}>
        <DialogHeader
          closeLabel={editing ? '关闭编辑项目' : '关闭创建项目'}
          closeDisabled={busy}
          onClose={close}
        >
          <h2 id={titleId}>{editing ? '编辑项目' : '创建项目'}</h2>
        </DialogHeader>
        <div className="due-project-body">
          <FormItem label="项目名称" hideLabel>
            <div className="due-project-name">
              <span className="due-project-name-icon">
                <FolderIcon />
              </span>
              <Input
                autoFocus
                value={title}
                disabled={locked}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="项目名称（可选，默认使用主要文件夹名称）"
              />
            </div>
          </FormItem>
          <section className="due-project-folders" aria-label="源文件夹">
            <div className="due-project-folders-heading">
              <h3>源文件夹</h3>
              {paths.length > 0 && <span className="due-project-count">{paths.length} 个目录</span>}
            </div>
            <div
              className={`due-project-source-card${paths.length ? ' due-project-source-card-filled' : ''}`}
            >
              {!paths.length && (
                <>
                  <p className="due-project-source-caption">在此电脑上添加文件夹</p>
                  <ActionButton
                    className="due-project-add"
                    label="添加"
                    icon={<FolderIcon add />}
                    disabled={busy}
                    onClick={pick}
                  />
                </>
              )}
              <ul>
                {paths.map((path, index) => (
                  <li key={path}>
                    <span className="due-project-folder-name" title={path}>
                      <FolderIcon />
                      <span>{path.split(/[\\/]/).filter(Boolean).at(-1) || path}</span>
                    </span>
                    {folderOpenEnabled && (
                      <button
                        type="button"
                        className="due-project-open-with"
                        aria-label={`选择 ${path} 的打开方式`}
                        title="在应用中打开"
                        aria-haspopup="menu"
                        aria-expanded={folderMenu?.path === path}
                        disabled={
                          busy ||
                          openingFolder ||
                          !apps?.some((id) => FOLDER_APPS.some((app) => app.id === id))
                        }
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          setFolderMenu({ path, x: rect.right, y: rect.bottom + 4 });
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          aria-hidden="true"
                        >
                          <path d="M12 15V3m-4 4 4-4 4 4M7 10H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" />
                        </svg>
                      </button>
                    )}
                    {index === 0 ? (
                      <span className="due-project-root-badge">主要</span>
                    ) : !editing ? (
                      <ActionButton
                        label="设为主要"
                        className="due-project-set-primary"
                        disabled={locked}
                        onClick={() =>
                          setPaths((previous) => [
                            path,
                            ...previous.filter((item) => item !== path),
                          ])
                        }
                      />
                    ) : null}
                    <button
                      type="button"
                      className="due-project-remove"
                      aria-label={`移除 ${path}`}
                      disabled={
                        busy ||
                        (editing && index === 0) ||
                        (Boolean(progress.current.workspaceId) &&
                          (index === 0 || progress.current.added.includes(path)))
                      }
                      onClick={() =>
                        setPaths((previous) => previous.filter((item) => item !== path))
                      }
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        aria-hidden="true"
                      >
                        <path d="m6 6 12 12M18 6 6 18" />
                      </svg>
                    </button>
                  </li>
                ))}
                {paths.length > 0 && (
                  <li className="due-project-add-row">
                    <button type="button" disabled={busy} onClick={pick}>
                      <FolderIcon add />
                      <span>添加文件夹</span>
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </section>
          {appError && (
            <p role="alert" className="due-project-error">
              {appError}
            </p>
          )}
          {error && (
            <p role="alert" className="due-project-error">
              {error}
              {editing && edit && '（请检查当前目录状态后重试保存。）'}
              {progress.current.workspaceId && '（项目已保留，可重试完成剩余步骤。）'}
            </p>
          )}
        </div>
        <footer className="due-project-actions">
          <ActionButton
            className="due-project-cancel"
            label="取消"
            disabled={busy}
            onClick={close}
          />
          <ActionButton
            type="submit"
            primary
            disabled={busy || (editing && !edit) || !paths.length}
            label={
              busy
                ? '处理中…'
                : editing
                  ? '保存'
                  : progress.current.workspaceId
                    ? '重试'
                    : '创建项目'
            }
          />
        </footer>
      </form>
      {open && folderOpenEnabled && folderMenu && apps && (
        <FolderOpenMenu
          target={folderMenu}
          apps={apps}
          onClose={() => setFolderMenu(null)}
          onSelect={launchFolder}
        />
      )}
    </dialog>
  );
}
