import type { Page } from 'playwright';
import type { DOMCandidate } from '../types.js';

export async function collectDOMCandidates(page: Page): Promise<DOMCandidate[]> {
  return page.evaluate(`() => {
    const nodes = Array.from(document.querySelectorAll('body *'));
    const getDepth = (el) => {
      let depth = 0;
      let cur = el;
      while (cur && cur.parentElement) {
        depth += 1;
        cur = cur.parentElement;
      }
      return depth;
    };

    return nodes.map((el, index) => ({
      tag: (el.tagName || '').toLowerCase(),
      role: el.getAttribute('role') || '',
      text: ((el.innerText || el.textContent || '').trim()).slice(0, 120),
      ariaLabel: el.getAttribute('aria-label') || '',
      testId: el.getAttribute('data-testid') || '',
      id: el.id || '',
      domDepth: getDepth(el),
      index
    }));
  }`);
}
