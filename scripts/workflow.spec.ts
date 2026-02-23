import type { SmartRunner } from '../backend/smartRunner.js';

export async function runWorkflow(smart: SmartRunner): Promise<void> {
  await smart.click('login_button');
}
