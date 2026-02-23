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

export function transformScriptToSmartCalls(script: string): string {
  return script.replace(/await\s+page\.(?:getByRole|getByText|getByLabel|locator)\([^\n]+?\.click\(\);/g, (line) => {
    const call = line.match(/page\.(?:getByRole|getByText|getByLabel|locator)\((.+?)\)\.click\(\)/);
    const key = normalizeKey(call?.[1]?.match(/'([^']+)'/)?.[1] ?? 'element');
    return `await smart.click('${key}');`;
  });
}


export function extractSmartClickLines(script: string): string[] {
  const smartified = transformScriptToSmartCalls(script);
  const lines = smartified
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith("await smart.click('") && l.endsWith(");"));
  return [...new Set(lines)];
}
