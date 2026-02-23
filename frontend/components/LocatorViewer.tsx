interface Props {
  registry: Record<string, unknown>;
  onRefresh: () => Promise<void>;
}

export function LocatorViewer(props: Props) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
      <h2>Locator Viewer</h2>
      <button onClick={props.onRefresh}>View Locator Registry</button>
      <pre style={{ maxHeight: 260, overflow: 'auto', background: '#0b1020', color: '#e2e8f0', padding: 12, borderRadius: 8 }}>
        {JSON.stringify(props.registry, null, 2)}
      </pre>
    </section>
  );
}
