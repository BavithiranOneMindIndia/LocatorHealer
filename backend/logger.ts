export function logAudit(event: string, payload: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${event}`, payload);
}
