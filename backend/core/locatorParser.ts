import type { LocatorMetadata, LocatorRegistry } from '../types.js';

const locatorRegex = /(getByRole|getByText|getByLabel|locator)\(([^;]+?)\)/g;

function normalizeKey(base: string): string {
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'element';
}

function parseMetadata(call: string): LocatorMetadata {
  const metadata: LocatorMetadata = {};
  const role = call.match(/getByRole\('([^']+)'/);
  const text = call.match(/name:\s*'([^']+)'|getByText\('([^']+)'/);
  const label = call.match(/getByLabel\('([^']+)'/);

  if (role) metadata.role = role[1];
  if (role && role[1] === 'textbox') metadata.tag = 'div';
  if (text) metadata.text = text[1] ?? text[2];
  if (label) {
    metadata.ariaLabel = label[1];
    metadata.text = label[1];
  }

  return metadata;
}

export function extractLocatorRegistry(scriptContents: string): LocatorRegistry {
  const registry: LocatorRegistry = {};
  let match: RegExpExecArray | null;

  while ((match = locatorRegex.exec(scriptContents)) !== null) {
    const fullCall = `${match[1]}(${match[2]})`;
    const metadata = parseMetadata(fullCall);
    const seed = metadata.ariaLabel ?? metadata.text ?? metadata.role ?? fullCall;
    const key = normalizeKey(seed);

    if (!registry[key]) {
      registry[key] = { primary: fullCall, metadata, history: [] };
    }
  }

  return registry;
}

function extractClickedLocatorCalls(script: string): string[] {
  const lines = script.split('\n');
  const calls: string[] = [];

  for (const line of lines) {
    const clickMatch = line.match(/page\.(getByRole|getByText|getByLabel|locator)\((.+?)\)\.click\(\)/);
    if (!clickMatch) continue;
    calls.push(`${clickMatch[1]}(${clickMatch[2]})`);
  }

  return calls;
}

interface RecordedAction {
  locator: string;
  action: 'click' | 'fill' | 'press';
  value?: string;
}

function extractRecordedActions(script: string): RecordedAction[] {
  const lines = script.split('\n');
  const actions: RecordedAction[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.includes('await page.')) continue;

    const actionMatch = line.match(/\.(click|fill|press)\((.*)\);?$/);
    if (!actionMatch) continue;

    const action = actionMatch[1] as RecordedAction['action'];
    const value = actionMatch[2]?.trim() || undefined;

    const locators = Array.from(line.matchAll(/(getByRole|getByText|getByLabel|locator)\(([^\n]+?)\)/g));
    if (locators.length === 0) continue;

    const last = locators[locators.length - 1];
    actions.push({ locator: `${last[1]}(${last[2]})`, action, value });
  }

  return actions;
}

function fallbackKeyFromLocator(call: string): string {
  return normalizeKey(call.match(/name:\s*'([^']+)'|getByText\('([^']+)'|getByLabel\('([^']+)'|locator\('#([^']+)'/)?.slice(1).find(Boolean) ?? call);
}

export function extractSmartActionLines(script: string, registry: LocatorRegistry): string[] {
  const primaryToKey = new Map<string, string>();
  Object.entries(registry).forEach(([key, entry]) => {
    primaryToKey.set(entry.primary, key);
  });

  const lines: string[] = [];
  for (const action of extractRecordedActions(script)) {
    const mappedKey = primaryToKey.get(action.locator);
    const fallbackKey = fallbackKeyFromLocator(action.locator);
    const key = mappedKey ?? (registry[fallbackKey] ? fallbackKey : null);
    if (!key) continue;

    if (action.action === 'click') {
      lines.push(`await smart.click('${key}');`);
      continue;
    }

    if (!action.value) continue;
    if (action.action === 'fill') {
      lines.push(`await smart.fill('${key}', ${action.value});`);
      continue;
    }

    if (action.action === 'press') {
      lines.push(`await smart.press('${key}', ${action.value});`);
    }
  }

  return lines;
}

export function extractSmartClickLines(script: string, registry: LocatorRegistry): string[] {
  if (script.includes('.fill(') || script.includes('.press(')) {
    return extractSmartActionLines(script, registry).filter((line) => line.includes('smart.click('));
  }

  const primaryToKey = new Map<string, string>();
  Object.entries(registry).forEach(([key, entry]) => {
    primaryToKey.set(entry.primary, key);
  });

  const lines: string[] = [];
  for (const call of extractClickedLocatorCalls(script)) {
    const key = primaryToKey.get(call);
    if (key) {
      lines.push(`await smart.click('${key}');`);
      continue;
    }

    const fallbackKey = normalizeKey(call.match(/name:\s*'([^']+)'|getByText\('([^']+)'|getByLabel\('([^']+)'|locator\('#([^']+)'/)?.slice(1).find(Boolean) ?? call);
    if (registry[fallbackKey]) {
      lines.push(`await smart.click('${fallbackKey}');`);
    }
  }

  return [...new Set(lines)];
}
