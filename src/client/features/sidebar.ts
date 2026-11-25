import { isZh, readFlag, writeFlag } from '../shared/browser';
const KEYS = {
  projects: 'dsh-sidebar-collapse:projects',
  ungrouped: 'dsh-sidebar-collapse:ungrouped',
};
const HEADER = '[data-sidebar-workspace-header]';
const ARROW = '[data-dsh-collapse-arrow]';
const UNGROUPED = '[data-dsh-nw-ungrouped]';
const HEADING = '[data-dsh-collapse-heading]';
const TOGGLE = '[data-dsh-collapse-toggle]';
const ADD = '[data-dsh-collapse-new]';
const NESTED_PROJECT =
  '[role="treeitem"][data-row-key^="workspace:"]:not([data-row-key="workspace:"])';

let projectsCollapsed = readFlag(KEYS.projects);
let ungroupedCollapsed = readFlag(KEYS.ungrouped);

function ensureHeaderArrow() {
  const header = document.querySelector(HEADER);
  if (!header) return;
  if (header.querySelector(ARROW)) return;
  const arrow = document.createElement('span');
  arrow.setAttribute('data-dsh-collapse-arrow', '');
  arrow.setAttribute('aria-hidden', 'true');
  const label = header.querySelector(':scope > span');
  if (label) label.insertAdjacentElement('afterend', arrow);
  else header.insertBefore(arrow, header.firstChild);
}

function markProjects() {
  const header = document.querySelector(HEADER);
  if (header) {
    ensureHeaderArrow();
    if (projectsCollapsed) header.setAttribute('data-dsh-collapse-projects', '');
    else header.removeAttribute('data-dsh-collapse-projects');
  }
  const hasProjects = document.querySelector(NESTED_PROJECT) !== null;
  const marked = new Set<Element>();
  if (projectsCollapsed && hasProjects) {
    // Fold by row, not by container: project rows, their sessions and the
    // session overflow buttons are hidden one by one, so a group whose
    // sessions render in a sibling wrapper cannot leak below the fold. The
    // standalone bucket (`workspace:`) and everything inside it stay put.
    document
      .querySelectorAll(
        '[data-row-key^="workspace:"], [data-row-key^="session:"], [data-row-key^="overflow:"]',
      )
      .forEach((el) => {
        if (el.getAttribute('data-row-key') === 'workspace:') return;
        if (el.closest(UNGROUPED)) return;
        if (el.querySelector('[data-row-key="workspace:"]')) return;
        marked.add(el);
      });
  }
  document.querySelectorAll('[data-dsh-collapse-hidden]').forEach((el) => {
    if (!marked.has(el)) el.removeAttribute('data-dsh-collapse-hidden');
  });
  marked.forEach((el) => el.setAttribute('data-dsh-collapse-hidden', ''));
}

function toggleUngrouped() {
  ungroupedCollapsed = !ungroupedCollapsed;
  writeFlag(KEYS.ungrouped, ungroupedCollapsed);
  applyFold();
}

function createStandalone() {
  // Mirror the sidebar's own new-session action exactly, so the + inherits
  // the same capability: workspace picker state, agent preset, draft
  // initialization and shortcut handling all come from that button.
  const native = document.querySelector<HTMLButtonElement>('button[class*="newSession"]');
  if (!native) {
    console.error('无法新建会话：未找到 DSH 新建会话按钮');
    return;
  }
  native.click();
}

/** SVG 使用 DOM 构建，兼容宿主的模块加载器与内容安全策略。 */
function createChatPlusIcon(): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  const attributes = {
    viewBox: '0 0 24 24',
    width: '16',
    height: '16',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  };
  for (const [name, value] of Object.entries(attributes)) svg.setAttribute(name, value);
  for (const d of ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z', 'M8 12h8', 'M12 8v8']) {
    const path = document.createElementNS(namespace, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

function ensureHeading(section: Element) {
  const fallback = isZh() ? '会话' : 'No Workspace';
  const label = section.getAttribute('data-dsh-nw-heading') || fallback;
  let heading = section.querySelector(HEADING);
  if (!heading) {
    heading = document.createElement('div');
    heading.setAttribute('data-dsh-collapse-heading', '');
    section.insertBefore(heading, section.firstChild);
  }
  let toggle = heading.querySelector<HTMLButtonElement>(TOGGLE);
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.setAttribute('data-dsh-collapse-toggle', '');
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleUngrouped();
    });
    heading.insertBefore(toggle, heading.firstChild);
  }
  if (toggle.textContent !== label) toggle.textContent = label;
  if (toggle.getAttribute('aria-expanded') !== String(!ungroupedCollapsed))
    toggle.setAttribute('aria-expanded', String(!ungroupedCollapsed));
  toggle.setAttribute('aria-label', label);
  let add = heading.querySelector<HTMLButtonElement>(ADD);
  if (!add) {
    add = document.createElement('button');
    add.type = 'button';
    add.setAttribute('data-dsh-collapse-new', '');
    add.appendChild(createChatPlusIcon());
    add.addEventListener('click', (event) => {
      event.stopPropagation();
      createStandalone();
    });
    heading.appendChild(add);
  }
  const addLabel = isZh() ? '新建会话' : 'New session';
  add.setAttribute('aria-label', addLabel);
  add.title = addLabel;
}

function markUngrouped() {
  document.querySelectorAll(UNGROUPED).forEach((el) => {
    // Only fold a container that owns the standalone bucket alone. Nested
    // project rows mean the fork marked a shared list, where hiding children
    // would take the project rows with it; session rows are expected here
    // and must not count as projects.
    const sharesProjects = el.querySelector(NESTED_PROJECT) !== null;
    if (sharesProjects) {
      el.removeAttribute('data-dsh-collapse-ungrouped');
      el.removeAttribute('data-dsh-collapse-has-toggle');
      const stale = el.querySelector(HEADING);
      if (stale) stale.remove();
      return;
    }
    ensureHeading(el);
    el.setAttribute('data-dsh-collapse-has-toggle', '');
    if (ungroupedCollapsed) el.setAttribute('data-dsh-collapse-ungrouped', '');
    else el.removeAttribute('data-dsh-collapse-ungrouped');
  });
}

function applyFold() {
  markProjects();
  markUngrouped();
}

const interactive = (target: Element) =>
  !!target.closest(
    'button, a[href], input, textarea, select, [role="button"], [role="textbox"], [contenteditable="true"], [data-dsh-collapse-ignore]',
  );

function onSidebarClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const header = target.closest(HEADER);
  if (header) {
    if (interactive(target)) return;
    projectsCollapsed = !projectsCollapsed;
    writeFlag(KEYS.projects, projectsCollapsed);
    applyFold();
    return;
  }
  if (target.matches(UNGROUPED)) toggleUngrouped();
}
export function installFold() {
  let queued = false;
  let frame = 0;
  const flush = () => {
    queued = false;
    applyFold();
  };
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    frame = requestAnimationFrame(flush);
  });
  const attach = () => {
    applyFold();
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'data-row-key',
        'aria-expanded',
        'data-dsh-nw-ungrouped',
        'data-dsh-nw-heading',
      ],
    });
    document.addEventListener('click', onSidebarClick, true);
  };
  if (document.body) attach();
  else document.addEventListener('DOMContentLoaded', attach, { once: true });
  return () => {
    document.removeEventListener('DOMContentLoaded', attach);
    document.removeEventListener('click', onSidebarClick, true);
    cancelAnimationFrame(frame);
    observer.disconnect();
    document.querySelectorAll(HEADING).forEach((el) => el.remove());
    document.querySelectorAll(ARROW).forEach((el) => el.remove());
    document
      .querySelectorAll(
        '[data-dsh-collapse-hidden], [data-dsh-collapse-projects], [data-dsh-collapse-ungrouped], [data-dsh-collapse-has-toggle]',
      )
      .forEach((el) => {
        el.removeAttribute('data-dsh-collapse-hidden');
        el.removeAttribute('data-dsh-collapse-projects');
        el.removeAttribute('data-dsh-collapse-ungrouped');
        el.removeAttribute('data-dsh-collapse-has-toggle');
      });
  };
}
