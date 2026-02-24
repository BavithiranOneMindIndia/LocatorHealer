export function logAudit(event: string, payload: Record<string, unknown>): void {
  console.log(`[${new Date().toISOString()}] ${event}`, payload);
}
