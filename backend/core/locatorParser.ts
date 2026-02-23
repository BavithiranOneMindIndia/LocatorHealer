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

export function extractSmartClickLines(script: string, registry: LocatorRegistry): string[] {
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
