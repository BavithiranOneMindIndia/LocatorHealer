export async function api(path: string, init?: RequestInit) {
  const res = await fetch(`http://localhost:3001${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
  return res.json();
}
