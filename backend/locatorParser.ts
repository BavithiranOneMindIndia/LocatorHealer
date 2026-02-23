import type { LocatorMetadata, LocatorRegistry } from './types.js';

const locatorRegex = /(getByRole|getByText|getByLabel|locator)\(([^;]+?)\)/g;

function normalizeKey(base: string): string {
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'element';
}

function parseMetadata(call: string): LocatorMetadata {
  const metadata: LocatorMetadata = {};
  const roleMatch = call.match(/getByRole\('([^']+)'/);
  const textMatch = call.match(/name:\s*'([^']+)'|getByText\('([^']+)'/);
  const labelMatch = call.match(/getByLabel\('([^']+)'/);

  if (roleMatch) {
    metadata.role = roleMatch[1];
    metadata.tag = roleMatch[1] === 'button' ? 'button' : undefined;
  }
  if (textMatch) {
    metadata.text = textMatch[1] ?? textMatch[2];
  }
  if (labelMatch) {
    metadata.label = labelMatch[1];
    metadata.text = labelMatch[1];
  }
  return metadata;
}

export function extractLocatorRegistry(scriptContents: string): LocatorRegistry {
  const registry: LocatorRegistry = {};
  let match: RegExpExecArray | null;

  while ((match = locatorRegex.exec(scriptContents)) !== null) {
    const fullCall = `${match[1]}(${match[2]})`;
    const metadata = parseMetadata(fullCall);
    const keySeed = metadata.text ?? metadata.label ?? metadata.role ?? fullCall;
    const key = normalizeKey(keySeed);

    if (!registry[key]) {
      registry[key] = {
        primary: fullCall,
        metadata,
        history: []
      };
    }
  }

  return registry;
}

export function transformScriptToSmartCalls(scriptContents: string): string {
  return scriptContents.replace(/await\s+page\.(?:getByRole|getByText|getByLabel|locator)\([^\n]+?\.click\(\);/g, (line) => {
    const call = line.match(/page\.(getByRole|getByText|getByLabel|locator)\((.+?)\)\.click\(\)/);
    const label = call?.[2]?.match(/'([^']+)'/)?.[1] ?? 'element';
    const elementKey = normalizeKey(label);
    return `await smart.click('${elementKey}');`;
  });
}
