import { useEffect, useState } from 'react';

type AuthMode = 'auth' | 'non-auth';
type RunMode = 'dev' | 'ci';

interface ProjectConfig {
  baseUrl: string;
  authMode: AuthMode;
  mode: RunMode;
  credentials?: { username: string; password: string };
  storageStatePath: string;
}

interface Proposal {
  elementKey: string;
  oldLocator: string;
  proposedLocator: string;
  similarity: number;
  risk: string;
  validated: boolean;
  approved: boolean;
}

const api = async (path: string, init?: RequestInit) => {
  const res = await fetch(`http://localhost:3001${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
  return res.json();
};

export function App() {
  const [config, setConfig] = useState<ProjectConfig>({
    baseUrl: 'https://example.com/login',
    authMode: 'non-auth',
    mode: 'dev',
    credentials: { username: '', password: '' },
    storageStatePath: 'auth/storage.json'
  });
  const [registry, setRegistry] = useState<Record<string, unknown>>({});
  const [proposals, setProposals] = useState<Proposal[]>([]);

  const refresh = async () => {
    const state = await api('/api/state');
    if (state.config) setConfig(state.config);
    setRegistry(state.registry || {});
    setProposals(state.proposals || []);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div style={{ fontFamily: 'Arial', padding: 20 }}>
      <h1>Playwright Locator Healer</h1>

      <h2>Project Setup</h2>
      <input
        style={{ width: 360 }}
        value={config.baseUrl}
        onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
        placeholder="Base URL"
      />
      <div>
        <label>Auth Mode </label>
        <select
          value={config.authMode}
          onChange={(e) => setConfig({ ...config, authMode: e.target.value as AuthMode })}
        >
          <option value="non-auth">Non-auth</option>
          <option value="auth">Auth</option>
        </select>
      </div>
      <div>
        <label>Mode </label>
        <select value={config.mode} onChange={(e) => setConfig({ ...config, mode: e.target.value as RunMode })}>
          <option value="dev">dev</option>
          <option value="ci">ci</option>
        </select>
      </div>

      {config.authMode === 'auth' && (
        <>
          <input
            value={config.credentials?.username ?? ''}
            onChange={(e) =>
              setConfig({ ...config, credentials: { ...(config.credentials ?? { username: '', password: '' }), username: e.target.value } })
            }
            placeholder="Username"
          />
          <input
            type="password"
            value={config.credentials?.password ?? ''}
            onChange={(e) =>
              setConfig({ ...config, credentials: { ...(config.credentials ?? { username: '', password: '' }), password: e.target.value } })
            }
            placeholder="Password"
          />
        </>
      )}

      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => api('/api/config', { method: 'POST', body: JSON.stringify(config) })}>Save Config</button>
        <button onClick={() => api('/api/record/start', { method: 'POST' })}>Start Recording</button>
        <button
          onClick={async () => {
            await api('/api/record/stop', { method: 'POST' });
            await refresh();
          }}
        >
          Stop Recording
        </button>
        <button onClick={() => api('/api/run', { method: 'POST' })}>Run Workflow</button>
        <button
          onClick={async () => {
            await api('/api/heal', { method: 'POST' });
            await refresh();
          }}
        >
          Heal
        </button>
        <button onClick={refresh}>View Locator Registry</button>
      </div>

      <h2>Locator Registry</h2>
      <pre>{JSON.stringify(registry, null, 2)}</pre>

      <h2>Heal Proposals</h2>
      {proposals.map((p) => (
        <div key={`${p.elementKey}-${p.proposedLocator}`} style={{ border: '1px solid #ccc', padding: 12, marginBottom: 10 }}>
          <p><strong>Element:</strong> {p.elementKey}</p>
          <p><strong>Old:</strong> {p.oldLocator}</p>
          <p><strong>New:</strong> {p.proposedLocator}</p>
          <p><strong>Similarity:</strong> {(p.similarity * 100).toFixed(0)}%</p>
          <p><strong>Risk:</strong> {p.risk}</p>
          <p><strong>Validated:</strong> {String(p.validated)}</p>
          <button onClick={async () => { await api('/api/approve', { method: 'POST', body: JSON.stringify({ elementKey: p.elementKey, approved: true }) }); await refresh(); }}>
            Approve
          </button>
          <button onClick={async () => { await api('/api/approve', { method: 'POST', body: JSON.stringify({ elementKey: p.elementKey, approved: false }) }); await refresh(); }}>
            Reject
          </button>
        </div>
      ))}
    </div>
  );
}
