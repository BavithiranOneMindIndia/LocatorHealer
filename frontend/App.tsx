import { useEffect, useMemo, useState, type CSSProperties } from 'react';

type AuthMode = 'auth' | 'non-auth';
type RunMode = 'dev' | 'ci';

interface AuthConfig {
  username?: string;
  password?: string;
  otp?: string;
  qrEnabled?: boolean;
  loginUrl?: string;
  successUrlIncludes?: string;
  successSelector?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  otpSelector?: string;
  submitSelector?: string;
}

interface ProjectConfig {
  baseUrl: string;
  authMode: AuthMode;
  mode: RunMode;
  auth?: AuthConfig;
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

const cardStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  marginBottom: 14
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #cfd4dc',
  marginTop: 6,
  marginBottom: 8
};

export function App() {
  const [config, setConfig] = useState<ProjectConfig>({
    baseUrl: 'https://web.whatsapp.com/',
    authMode: 'auth',
    mode: 'dev',
    auth: {
      username: '',
      password: '',
      otp: '',
      qrEnabled: true,
      loginUrl: 'https://web.whatsapp.com/',
      successUrlIncludes: 'web.whatsapp.com',
      successSelector: '[data-testid="chat-list"]'
    },
    storageStatePath: 'auth/storage.json'
  });
  const [registry, setRegistry] = useState<Record<string, unknown>>({});
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [toast, setToast] = useState('');
  const [authStatus, setAuthStatus] = useState('No active auth session.');

  const canRecord = useMemo(() => config.authMode === 'non-auth' || !!config.storageStatePath, [config]);

  const refresh = async () => {
    const state = await api('/api/state');
    if (state.config) setConfig(state.config);
    setRegistry(state.registry || {});
    setProposals(state.proposals || []);
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div style={{ fontFamily: 'Inter, Arial', background: '#f6f8fb', minHeight: '100vh', padding: 18 }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 4 }}>Locator Healer Studio</h1>
        <p style={{ marginTop: 0, color: '#4b5563' }}>Record → Store → Heal → Approve → Update Locator</p>

        {toast && <div style={{ ...cardStyle, border: '1px solid #16a34a', background: '#ecfdf3' }}>{toast}</div>}

        <section style={cardStyle}>
          <h2>1) Project Setup</h2>
          <label>Base URL</label>
          <input
            style={inputStyle}
            value={config.baseUrl}
            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
            placeholder="https://example.com/login"
          />

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label>Auth Mode</label>
              <select
                style={inputStyle}
                value={config.authMode}
                onChange={(e) => setConfig({ ...config, authMode: e.target.value as AuthMode })}
              >
                <option value="non-auth">Non-auth</option>
                <option value="auth">Auth</option>
              </select>
            </div>
            <div>
              <label>Run Mode</label>
              <select
                style={inputStyle}
                value={config.mode}
                onChange={(e) => setConfig({ ...config, mode: e.target.value as RunMode })}
              >
                <option value="dev">dev</option>
                <option value="ci">ci</option>
              </select>
            </div>
          </div>

          <label>Storage State Path</label>
          <input
            style={inputStyle}
            value={config.storageStatePath}
            onChange={(e) => setConfig({ ...config, storageStatePath: e.target.value })}
          />

          {config.authMode === 'auth' && (
            <div style={{ marginTop: 8, padding: 12, borderRadius: 8, border: '1px dashed #93c5fd', background: '#eff6ff' }}>
              <h3 style={{ marginTop: 0 }}>Auth Configuration (Username/Password/OTP/QR)</h3>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <label>Username</label>
                  <input
                    style={inputStyle}
                    value={config.auth?.username ?? ''}
                    onChange={(e) =>
                      setConfig({ ...config, auth: { ...(config.auth ?? {}), username: e.target.value } })
                    }
                  />
                </div>
                <div>
                  <label>Password</label>
                  <input
                    type="password"
                    style={inputStyle}
                    value={config.auth?.password ?? ''}
                    onChange={(e) =>
                      setConfig({ ...config, auth: { ...(config.auth ?? {}), password: e.target.value } })
                    }
                  />
                </div>
                <div>
                  <label>OTP (optional)</label>
                  <input
                    style={inputStyle}
                    value={config.auth?.otp ?? ''}
                    onChange={(e) => setConfig({ ...config, auth: { ...(config.auth ?? {}), otp: e.target.value } })}
                  />
                </div>
                <div>
                  <label>Login URL (for QR flow use WhatsApp URL)</label>
                  <input
                    style={inputStyle}
                    value={config.auth?.loginUrl ?? ''}
                    onChange={(e) =>
                      setConfig({ ...config, auth: { ...(config.auth ?? {}), loginUrl: e.target.value } })
                    }
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <label>Success URL contains</label>
                  <input
                    style={inputStyle}
                    value={config.auth?.successUrlIncludes ?? ''}
                    onChange={(e) =>
                      setConfig({ ...config, auth: { ...(config.auth ?? {}), successUrlIncludes: e.target.value } })
                    }
                  />
                </div>
                <div>
                  <label>Success selector</label>
                  <input
                    style={inputStyle}
                    value={config.auth?.successSelector ?? ''}
                    onChange={(e) =>
                      setConfig({ ...config, auth: { ...(config.auth ?? {}), successSelector: e.target.value } })
                    }
                    placeholder='e.g. [data-testid="chat-list"]'
                  />
                </div>
              </div>

              <button
                onClick={async () => {
                  await api('/api/config', { method: 'POST', body: JSON.stringify(config) });
                  const r = await api('/api/auth/start', { method: 'POST' });
                  setAuthStatus(r.message || 'Auth session started');
                }}
              >
                Start Auth Capture
              </button>
              <button
                style={{ marginLeft: 8 }}
                onClick={async () => {
                  const r = await api('/api/auth/status');
                  setAuthStatus(r.message || 'Checked auth status');
                  if (r.authenticated) {
                    setToast('✅ Authentication detected. Save auth state now.');
                  }
                }}
              >
                Check Auth Status
              </button>
              <button
                style={{ marginLeft: 8 }}
                onClick={async () => {
                  const r = await api('/api/auth/save', { method: 'POST' });
                  setToast(r.message || 'Auth saved');
                  setAuthStatus('Auth saved. Continue with recording.');
                }}
              >
                Save Auth State
              </button>
              <button style={{ marginLeft: 8 }} onClick={() => api('/api/auth/cancel', { method: 'POST' })}>
                Cancel Auth Session
              </button>

              <p style={{ marginBottom: 0, marginTop: 10, color: '#374151' }}>{authStatus}</p>
            </div>
          )}

          <button
            onClick={async () => {
              await api('/api/config', { method: 'POST', body: JSON.stringify(config) });
              setToast('Project config saved');
            }}
          >
            Save Config
          </button>
        </section>

        <section style={cardStyle}>
          <h2>2) Recording + Execution</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button disabled={!canRecord} onClick={() => api('/api/record/start', { method: 'POST' })}>Start Recording</button>
            <button
              onClick={async () => {
                await api('/api/record/stop', { method: 'POST' });
                await refresh();
                setToast('Recording stopped, script parsed, registry updated.');
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
        </section>

        <section style={cardStyle}>
          <h2>Locator Registry</h2>
          <pre style={{ maxHeight: 260, overflow: 'auto', background: '#0b1020', color: '#e2e8f0', padding: 12, borderRadius: 8 }}>
            {JSON.stringify(registry, null, 2)}
          </pre>
        </section>

        <section style={cardStyle}>
          <h2>Heal Proposals (Approve / Reject)</h2>
          {proposals.length === 0 && <p>No pending proposals.</p>}
          {proposals.map((p) => (
            <div key={`${p.elementKey}-${p.proposedLocator}`} style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <p><strong>Element:</strong> {p.elementKey}</p>
              <p><strong>Old locator:</strong> {p.oldLocator}</p>
              <p><strong>Proposed locator:</strong> {p.proposedLocator}</p>
              <p><strong>Similarity:</strong> {(p.similarity * 100).toFixed(0)}%</p>
              <p><strong>Risk:</strong> {p.risk}</p>
              <p><strong>Validated:</strong> {String(p.validated)}</p>
              <button
                onClick={async () => {
                  await api('/api/approve', {
                    method: 'POST',
                    body: JSON.stringify({ elementKey: p.elementKey, approved: true })
                  });
                  await refresh();
                }}
              >
                Approve
              </button>
              <button
                style={{ marginLeft: 8 }}
                onClick={async () => {
                  await api('/api/approve', {
                    method: 'POST',
                    body: JSON.stringify({ elementKey: p.elementKey, approved: false })
                  });
                  await refresh();
                }}
              >
                Reject
              </button>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
