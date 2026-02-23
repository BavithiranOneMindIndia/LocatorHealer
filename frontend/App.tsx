import { useEffect, useState } from 'react';
import { ConfigPage } from './components/ConfigPage';
import { HealDashboard } from './components/HealDashboard';
import { LocatorViewer } from './components/LocatorViewer';
import { api } from './components/api';
import type { HealProposal, ProjectConfig } from './components/types';
import { ActionModal } from './components/ActionModal';
import { WorkflowCenter } from './components/WorkflowCenter';

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
  const [workflows, setWorkflows] = useState<string[]>([]);
  const [authStatus, setAuthStatus] = useState('No active auth session.');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState({ open: false, title: '', message: '' });

  const openModal = (title: string, message: string) => setModal({ open: true, title, message });

  const refresh = async () => {
    const state = await api('/api/state');
    if (state.config) setConfig(state.config);
    setRegistry(state.registry ?? {});
    setProposals(state.proposals ?? []);

    const wf = await api('/api/run/workflows');
    setWorkflows(wf.workflows ?? []);
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div style={{ fontFamily: 'Inter, Arial', background: 'linear-gradient(180deg,#f8fbff,#f1f5f9)', minHeight: '100vh', padding: 18 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 4 }}>WhatsApp Self-Healing Playwright Studio</h1>
        <p style={{ marginTop: 0, color: '#475569' }}>Record → Store → Heal → Approve → Update Locator</p>

        {toast && (
          <div style={{ background: '#ecfdf3', border: '1px solid #16a34a', padding: 10, borderRadius: 8, marginBottom: 10 }}>
            {toast}
          </div>
        )}

        <ConfigPage
          config={config}
          authStatus={authStatus}
          onConfigChange={setConfig}
          onSaveConfig={async () => {
            await api('/api/config', { method: 'POST', body: JSON.stringify(config) });
            setToast('Config saved');
            openModal('Configuration Saved', 'Project configuration has been persisted successfully.');
          }}
          onStartAuth={async () => {
            await api('/api/config', { method: 'POST', body: JSON.stringify(config) });
            const r = await api('/api/auth/start', { method: 'POST' });
            setAuthStatus(r.message ?? 'Auth started');
            openModal('Auth Session Started', 'Browser opened for QR/OTP/manual login. Complete login and check status.');
          }}
          onCheckAuth={async () => {
            const r = await api('/api/auth/status');
            setAuthStatus(r.message ?? 'Checked auth status');
            if (r.authenticated) {
              setToast('Auth detected. You can save state now.');
              openModal('Authentication Detected', 'Session is authenticated. Click Save Auth to persist storage state.');
            }
          }}
          onSaveAuth={async () => {
            const r = await api('/api/auth/save', { method: 'POST' });
            setAuthStatus(r.message ?? 'Auth saved');
            setToast('Auth saved successfully. Continue recording workflow.');
            openModal('Auth Saved', 'Storage state has been saved and will be reused during runs.');
          }}
          onCancelAuth={async () => {
            await api('/api/auth/cancel', { method: 'POST' });
            setAuthStatus('Auth session cancelled');
          }}
        />

        <WorkflowCenter
          workflows={workflows}
          onRecordStart={async () => {
            const r = await api('/api/record/start', { method: 'POST' });
            openModal('Recording Started', r.message ?? 'Playwright codegen started.');
          }}
          onRecordStop={async () => {
            const r = await api('/api/record/stop', { method: 'POST' });
            await refresh();
            openModal('Recording Completed', `Locators extracted: ${r.registrySize ?? 0}.`);
          }}
          onRun={async () => {
            const r = await api('/api/run', { method: 'POST', body: JSON.stringify({ workflow: workflows[0] ?? 'workflow.spec.ts' }) });
            if (r.ok) {
              openModal('Workflow Completed', r.message ?? 'Workflow executed successfully.');
            } else {
              openModal('Workflow Failed', r.error ?? 'Execution failed.');
            }
            await refresh();
          }}
          onHeal={async () => {
            const r = await api('/api/heal/scan', { method: 'POST' });
            await refresh();
            openModal('Heal Scan Finished', `Checked: ${r.checked ?? 0}, Proposed: ${r.healed ?? 0}`);
          }}
        />

        <HealDashboard
          proposals={proposals}
          onHealScan={async () => {
            const r = await api('/api/heal/scan', { method: 'POST' });
            await refresh();
            openModal('Heal Triggered', `Checked: ${r.checked ?? 0}, Proposed: ${r.healed ?? 0}`);
          }}
          onApprove={async (elementKey, approved) => {
            await api('/api/approve', { method: 'POST', body: JSON.stringify({ elementKey, approved }) });
            await refresh();
            openModal(approved ? 'Proposal Approved' : 'Proposal Rejected', `Element key: ${elementKey}`);
          }}
        />

        <LocatorViewer registry={registry} onRefresh={refresh} />

        <ActionModal
          open={modal.open}
          title={modal.title}
          message={modal.message}
          onClose={() => setModal({ open: false, title: '', message: '' })}
        />
      </div>
    </div>
  );
}
