interface Props {
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
  onRunWorkflow: () => Promise<void>;
}

export function Recorder(props: Props) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 14 }}>
      <h2>Recorder</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={props.onStartRecording}>Start Recording</button>
        <button onClick={props.onStopRecording}>Stop Recording</button>
        <button onClick={props.onRunWorkflow}>Run Workflow</button>
      </div>
    </section>
  );
}
