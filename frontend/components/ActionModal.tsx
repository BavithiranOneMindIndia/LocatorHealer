interface Props {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export function ActionModal({ open, title, message, onClose }: Props) {
  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ width: 520, background: '#fff', borderRadius: 12, boxShadow: '0 10px 30px rgba(2,6,23,0.25)', padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
