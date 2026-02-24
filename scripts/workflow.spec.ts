import type { SmartRunner } from '../backend/core/smartRunner.js';

export async function runWorkflow(smart: SmartRunner): Promise<void> {
  await smart.click('search_input');
}
