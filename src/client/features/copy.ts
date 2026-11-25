import { isZh } from '../shared/browser';
import { getEnabled } from '../shared/settings';
type Rules = Record<string, string>;
type CopyRecord = { original: string; applied: string };
const RULES_KEY = 'dsh-ui-titles:renames:v1';
export const DEFAULTS = { 工作区: '项目' };
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
const SKIP = [
  'script',
  'style',
  'noscript',
  'textarea',
  'input',
  'select',
  'option',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(',');

const skipped = (el: Element | null) => !!el?.closest(SKIP);

function loadRules(): Rules {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULTS };
    const rules: Rules = {};
    for (const [from, to] of Object.entries(parsed)) {
      if (from.trim() !== '' && typeof to === 'string') rules[from] = to;
    }
    return rules;
  } catch {
    return { ...DEFAULTS };
  }
}

export function serializeRules(rules: Rules) {
  return Object.entries(rules)
    .map(([from, to]) => `${from} => ${to}`)
    .join('\n');
}

export function parseRules(text: string) {
  const rules: Rules = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('=>');
    if (at <= 0) return null;
    const from = line.slice(0, at).trim();
    const to = line.slice(at + 2).trim();
    if (!from) return null;
    rules[from] = to;
  }
  return rules;
}

let rules = loadRules();
export const getRules = () => rules;
export function saveRules(next: Rules) {
  rules = next;
  try {
    localStorage.setItem(RULES_KEY, JSON.stringify(next));
  } catch {
    /* 本地存储不可用时仍在当前页面生效。 */
  }
  restoreCopy();
  applyCopy();
}
const textRecords = new WeakMap<Text, CopyRecord>();
const attrRecords = new WeakMap<Element, Record<string, CopyRecord>>();
const touched = new Set<Text | Element>();

function desiredFor(value: string) {
  const text = value.trim();
  if (!text || !Object.prototype.hasOwnProperty.call(rules, text)) return undefined;
  return value.replace(text, rules[text]);
}

function fixText(node: Text) {
  if (skipped(node.parentElement)) return;
  const current = node.data;
  const previous = textRecords.get(node);
  const base = previous && previous.applied === current ? previous.original : current;
  const desired = desiredFor(base);
  const target = desired === undefined ? base : desired;
  if (target === current) return;
  if (target === base) textRecords.delete(node);
  else textRecords.set(node, { original: base, applied: target });
  node.data = target;
  touched.add(node);
}

function fixAttrs(el: Element) {
  if (skipped(el)) return;
  let record = attrRecords.get(el);
  for (const name of ATTRS) {
    const current = el.getAttribute(name);
    if (current === null) {
      if (record) delete record[name];
      continue;
    }
    const previous = record ? record[name] : undefined;
    const base = previous && previous.applied === current ? previous.original : current;
    const desired = desiredFor(base);
    const target = desired === undefined ? base : desired;
    if (target === current) continue;
    if (target === base) {
      if (record) delete record[name];
    } else {
      if (!record) {
        record = {};
        attrRecords.set(el, record);
      }
      record[name] = { original: base, applied: target };
    }
    el.setAttribute(name, target);
    touched.add(el);
  }
}

function walkCopy(root: Node) {
  if (root.nodeType === 3) {
    fixText(root as Text);
    return;
  }
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  if (root.nodeType === 1) {
    if (skipped(root as Element)) return;
    fixAttrs(root as Element);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === 1) {
        return skipped(node as Element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
      return skipped(node.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeType === 3) fixText(node as Text);
    else fixAttrs(node as Element);
  }
}

function restoreCopy() {
  for (const node of touched) {
    if (!node.isConnected) {
      touched.delete(node);
      continue;
    }
    if (node instanceof Text) {
      const record = textRecords.get(node);
      if (record && node.data === record.applied) node.data = record.original;
      textRecords.delete(node);
    } else if (node instanceof Element) {
      const record = attrRecords.get(node);
      if (record) {
        for (const [name, entry] of Object.entries(record)) {
          if (node.getAttribute(name) === entry.applied) node.setAttribute(name, entry.original);
        }
        attrRecords.delete(node);
      }
    }
    touched.delete(node);
  }
}

function applyCopy() {
  if (!getEnabled() || !isZh()) {
    restoreCopy();
    return;
  }
  walkCopy(document.body);
}
export function installCopy() {
  let queued = false;
  let frame = 0;
  const pending = new Set<Node>();
  const flush = () => {
    queued = false;
    const targets = [...pending];
    pending.clear();
    if (!isZh()) return;
    for (const target of targets) {
      if (!target.isConnected) continue;
      walkCopy(target);
    }
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'childList') {
        record.addedNodes.forEach((node) => {
          pending.add(node);
        });
      } else if (record.type === 'characterData' || record.type === 'attributes') {
        pending.add(record.target);
      }
    }
    if (pending.size > 0 && !queued) {
      queued = true;
      frame = requestAnimationFrame(flush);
    }
  });
  const langObserver = new MutationObserver(() => applyCopy());
  const attach = () => {
    if (!document.body) return;
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });
    langObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    applyCopy();
  };
  if (document.body) attach();
  else document.addEventListener('DOMContentLoaded', attach, { once: true });
  return () => {
    document.removeEventListener('DOMContentLoaded', attach);
    cancelAnimationFrame(frame);
    pending.clear();
    observer.disconnect();
    langObserver.disconnect();
    restoreCopy();
  };
}
