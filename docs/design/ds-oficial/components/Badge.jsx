export function Badge({ children, tone = 'orange', variant = 'solid', dot = false }) {
  const solid = {
    orange: { background: 'var(--ape-orange)', color: '#fff' },
    purple: { background: 'var(--ape-purple)', color: '#fff' },
    success: { background: 'var(--success)', color: '#fff' },
    warning: { background: 'var(--warning)', color: '#fff' },
    danger: { background: 'var(--danger)', color: '#fff' },
    neutral: { background: 'var(--neutral-800)', color: '#fff' },
  };
  const soft = {
    orange: { background: 'var(--ape-orange-100)', color: 'var(--ape-orange-700)' },
    purple: { background: 'var(--ape-purple-100)', color: 'var(--ape-purple-700)' },
    success: { background: 'var(--success-bg)', color: 'var(--success)' },
    warning: { background: 'var(--warning-bg)', color: '#9c6a14' },
    danger: { background: 'var(--danger-bg)', color: 'var(--danger)' },
    neutral: { background: 'var(--neutral-100)', color: 'var(--neutral-700)' },
  };
  const palette = variant === 'soft' ? soft : solid;
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    borderRadius: 'var(--radius-pill)',
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.2,
    ...(palette[tone] || palette.orange),
  };
  const dotColor = (variant === 'soft' ? solid[tone] : { background: 'currentColor' }).background;
  return (
    <span style={style}>
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
      )}
      {children}
    </span>
  );
}
