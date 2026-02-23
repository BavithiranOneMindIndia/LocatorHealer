import type { CSSProperties } from 'react';
import type { ProjectConfig, AuthMode, RunMode } from './types';

interface Props {
  config: ProjectConfig;
  authStatus: string;
  onConfigChange: (c: ProjectConfig) => void;
  onSaveConfig: () => Promise<void>;
  onStartAuth: () => Promise<void>;
  onCheckAuth: () => Promise<void>;
  onSaveAuth: () => Promise<void>;
  onCancelAuth: () => Promise<void>;
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #cfd4dc',
  marginTop: 6,
  marginBottom: 8
};

export function ConfigPage(props: Props) {
  const { config, onConfigChange } = props;

  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 14 }}>
      <h2>Config Page</h2>
      <label>Base URL</label>
      <input style={inputStyle} value={config.baseUrl} onChange={(e) => onConfigChange({ ...config, baseUrl: e.target.value })} />

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <label>Auth Mode</label>
          <select style={inputStyle} value={config.authMode} onChange={(e) => onConfigChange({ ...config, authMode: e.target.value as AuthMode })}>
            <option value="non-auth">Non-auth</option>
            <option value="auth">Auth</option>
          </select>
        </div>
        <div>
          <label>Run Mode</label>
          <select style={inputStyle} value={config.mode} onChange={(e) => onConfigChange({ ...config, mode: e.target.value as RunMode })}>
            <option value="dev">dev</option>
            <option value="ci">ci</option>
          </select>
        </div>
      </div>

      <label>Storage State Path</label>
      <input
        style={inputStyle}
        value={config.storageStatePath}
        onChange={(e) => onConfigChange({ ...config, storageStatePath: e.target.value })}
      />

      {config.authMode === 'auth' && (
        <div style={{ padding: 12, border: '1px dashed #93c5fd', borderRadius: 8, background: '#eff6ff' }}>
          <h3>WhatsApp Auth (QR/OTP/Login)</h3>
          <input
            style={inputStyle}
            placeholder="Login URL"
            value={config.auth?.loginUrl ?? ''}
            onChange={(e) => onConfigChange({ ...config, auth: { ...(config.auth ?? {}), loginUrl: e.target.value, qrEnabled: true } })}
          />
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <input
              style={inputStyle}
              placeholder="Username"
              value={config.auth?.username ?? ''}
              onChange={(e) => onConfigChange({ ...config, auth: { ...(config.auth ?? {}), username: e.target.value } })}
            />
            <input
              style={inputStyle}
              type="password"
              placeholder="Password"
              value={config.auth?.password ?? ''}
              onChange={(e) => onConfigChange({ ...config, auth: { ...(config.auth ?? {}), password: e.target.value } })}
            />
          </div>
          <input
            style={inputStyle}
            placeholder="OTP (optional)"
            value={config.auth?.otp ?? ''}
            onChange={(e) => onConfigChange({ ...config, auth: { ...(config.auth ?? {}), otp: e.target.value } })}
          />
          <input
            style={inputStyle}
            placeholder="Success selector e.g. [data-testid='chat-list']"
            value={config.auth?.successSelector ?? ''}
            onChange={(e) => onConfigChange({ ...config, auth: { ...(config.auth ?? {}), successSelector: e.target.value } })}
          />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={props.onStartAuth}>Scan QR / Start Auth</button>
            <button onClick={props.onCheckAuth}>Check Auth Status</button>
            <button onClick={props.onSaveAuth}>Save Auth</button>
            <button onClick={props.onCancelAuth}>Cancel Auth Session</button>
          </div>
          <p>{props.authStatus}</p>
        </div>
      )}

      <button onClick={props.onSaveConfig}>Save Config</button>
    </section>
  );
}
