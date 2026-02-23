import { useEffect, useState } from 'react';
import { ConfigPage } from './components/ConfigPage';
import { Recorder } from './components/Recorder';
import { HealDashboard } from './components/HealDashboard';
import { LocatorViewer } from './components/LocatorViewer';
import { api } from './components/api';
import type { HealProposal, ProjectConfig } from './components/types';

export function App() {
  const [config, setConfig] = useState<ProjectConfig>({
    baseUrl: 'https://web.whatsapp.com/',
    authMode: 'auth',
    mode: 'dev',
    auth: {
      qrEnabled: true,
      loginUrl: 'https://web.whatsapp.com/',
      successUrlIncludes: 'web.whatsapp.com',
      successSelector: '[data-testid="chat-list"]'
    },
    storageStatePath: 'backend/auth/storageState.json'
  });
  const [registry, setRegistry] = useState<Record<string, unknown>>({});
  const [proposals, setProposals] = useState<HealProposal[]>([]);
  const [authStatus, setAuthStatus] = useState('No active auth session.');
  const [toast, setToast] = useState('');

  const refresh = async () => {
    const state = await api('/api/state');
    if (state.config) setConfig(state.config);
    setRegistry(state.registry ?? {});
    setProposals(state.proposals ?? []);
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div style={{ fontFamily: 'Inter, Arial', background: '#f6f8fb', minHeight: '100vh', padding: 18 }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <h1>WhatsApp Self-Healing Playwright Framework</h1>
        <p>Record → Store → Heal → Approve → Update Locator</p>

        {toast && <div style={{ background: '#ecfdf3', border: '1px solid #16a34a', padding: 10, borderRadius: 8, marginBottom: 10 }}>{toast}</div>}

        <ConfigPage
          config={config}
          authStatus={authStatus}
          onConfigChange={setConfig}
          onSaveConfig={async () => {
            await api('/api/config', { method: 'POST', body: JSON.stringify(config) });
            setToast('Config saved');
          }}
          onStartAuth={async () => {
            await api('/api/config', { method: 'POST', body: JSON.stringify(config) });
            const r = await api('/api/auth/start', { method: 'POST' });
            setAuthStatus(r.message ?? 'Auth started');
          }}
          onCheckAuth={async () => {
            const r = await api('/api/auth/status');
            setAuthStatus(r.message ?? 'Checked auth status');
            if (r.authenticated) setToast('Auth detected. You can save state now.');
          }}
          onSaveAuth={async () => {
            const r = await api('/api/auth/save', { method: 'POST' });
            setAuthStatus(r.message ?? 'Auth saved');
            setToast('Auth saved successfully. Continue recording workflow.');
          }}
          onCancelAuth={async () => {
            await api('/api/auth/cancel', { method: 'POST' });
            setAuthStatus('Auth session cancelled');
          }}
        />

        <Recorder
          onStartRecording={async () => { await api('/api/record/start', { method: 'POST' }); }}
          onStopRecording={async () => {
            await api('/api/record/stop', { method: 'POST' });
            await refresh();
          }}
          onRunWorkflow={async () => { await api('/api/run', { method: 'POST' }); }}
        />

        <HealDashboard
          proposals={proposals}
          onHealScan={async () => {
            await api('/api/heal/scan', { method: 'POST' });
            await refresh();
          }}
          onApprove={async (elementKey, approved) => {
            await api('/api/approve', { method: 'POST', body: JSON.stringify({ elementKey, approved }) });
            await refresh();
          }}
        />

        <LocatorViewer registry={registry} onRefresh={refresh} />
      </div>
    </div>
  );
}
