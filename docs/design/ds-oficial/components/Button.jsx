export function Button({
  children,
  variant = 'primary',
  size = 'md',
  as = 'button',
  ...rest
}) {
  const pad = size === 'sm' ? '9px 18px' : size === 'lg' ? '16px 28px' : '12px 22px';
  const fontSize = size === 'sm' ? 14 : size === 'lg' ? 17 : 15;

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize,
    padding: pad,
    borderRadius: 'var(--radius-pill)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all var(--dur-fast) var(--ease-out)',
    textDecoration: 'none',
    lineHeight: 1,
  };

  const variants = {
    primary: {
      background: 'var(--ape-orange)',
      color: '#fff',
      boxShadow: 'var(--shadow-brand)',
    },
    accent: {
      background: 'var(--ape-purple)',
      color: '#fff',
      boxShadow: 'var(--shadow-accent)',
    },
    secondary: {
      background: '#fff',
      color: 'var(--fg-1)',
      border: '1.5px solid var(--border-default)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ape-orange)',
      borderRadius: 'var(--radius-md)',
    },
  };

  const Tag = as;
  return (
    <Tag style={{ ...base, ...(variants[variant] || variants.primary) }} {...rest}>
      {children}
    </Tag>
  );
}
