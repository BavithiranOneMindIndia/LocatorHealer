export interface ActivityEvent {
  ts: string;
  scope: 'run' | 'heal' | 'record' | 'auth' | 'config';
  message: string;
  details?: Record<string, unknown>;
}

const events: ActivityEvent[] = [];

export function pushActivity(event: ActivityEvent): void {
  events.unshift(event);
  if (events.length > 200) events.pop();
}

export function getActivity(): ActivityEvent[] {
  return events;
}
