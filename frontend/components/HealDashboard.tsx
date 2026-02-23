import type { HealProposal } from './types';

interface Props {
  proposals: HealProposal[];
  onHealScan: () => Promise<void>;
  onApprove: (elementKey: string, approved: boolean) => Promise<void>;
}

export function HealDashboard(props: Props) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 14 }}>
      <h2>Heal Dashboard</h2>
      <button onClick={props.onHealScan}>Heal</button>

      {props.proposals.length === 0 && <p>No proposed changes.</p>}
      {props.proposals.map((p) => (
        <div key={`${p.elementKey}-${p.proposedLocator}`} style={{ marginTop: 10, border: '1px solid #cbd5e1', borderRadius: 8, padding: 10 }}>
          <p><strong>Element:</strong> {p.elementKey}</p>
          <p><strong>Old:</strong> {p.oldLocator}</p>
          <p><strong>New:</strong> {p.proposedLocator}</p>
          <p><strong>Similarity:</strong> {(p.similarity * 100).toFixed(0)}%</p>
          <p><strong>Risk:</strong> {p.risk}</p>
          <button onClick={() => props.onApprove(p.elementKey, true)}>Approve</button>
          <button style={{ marginLeft: 8 }} onClick={() => props.onApprove(p.elementKey, false)}>Reject</button>
        </div>
      ))}
    </section>
  );
}
