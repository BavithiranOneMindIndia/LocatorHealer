interface Props {
  workflows: string[];
  selectedWorkflow: string;
  newWorkflowName: string;
  onSelectedWorkflowChange: (v: string) => void;
  onNewWorkflowNameChange: (v: string) => void;
  onRun: () => Promise<void>;
  onRecordStart: () => Promise<void>;
  onRecordStop: () => Promise<void>;
  onHeal: () => Promise<void>;
}

export function WorkflowCenter({ workflows, selectedWorkflow, newWorkflowName, onSelectedWorkflowChange, onNewWorkflowNameChange, onRun, onRecordStart, onRecordStop, onHeal }: Props) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 14 }}>
      <h2>Workflow Center</h2>
      <p style={{ color: '#475569' }}>Manage multiple workflows and healing actions from one place.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div style={{ border: '1px solid #dbeafe', background: '#eff6ff', borderRadius: 8, padding: 10 }}>
          <h3 style={{ marginTop: 0 }}>Available Workflows</h3>
          {workflows.length === 0 && <p>No workflows found.</p>}
          <select
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #93c5fd', marginBottom: 8 }}
            value={selectedWorkflow}
            onChange={(e) => onSelectedWorkflowChange(e.target.value)}
          >
            {workflows.map((wf) => <option key={wf} value={wf}>{wf}</option>)}
          </select>

          {workflows.map((wf) => (
            <div key={wf} style={{ padding: '8px 10px', background: wf === selectedWorkflow ? '#dbeafe' : '#fff', borderRadius: 6, border: '1px solid #bfdbfe', marginBottom: 8 }}>
              {wf}
            </div>
          ))}
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
          <h3 style={{ marginTop: 0 }}>Actions</h3>
          <input
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: 8 }}
            value={newWorkflowName}
            onChange={(e) => onNewWorkflowNameChange(e.target.value)}
            placeholder="new workflow name"
          />
          <div style={{ display: 'grid', gap: 8 }}>
            <button onClick={onRecordStart}>Start Recording</button>
            <button onClick={onRecordStop}>Stop Recording</button>
            <button onClick={onRun}>Run Selected Workflow</button>
            <button onClick={onHeal}>Run Heal Scan</button>
          </div>
        </div>
      </div>
    </section>
  );
}
