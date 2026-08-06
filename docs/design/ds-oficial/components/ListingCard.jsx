import * as React from 'react';

const iconBase = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function MapPin(p) {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} {...iconBase} {...p}>
      <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function Bed(p) {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} {...iconBase} {...p}>
      <path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" />
      <path d="M2 17h20" /><path d="M6 8v9" />
    </svg>
  );
}
function Bath(p) {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} {...iconBase} {...p}>
      <path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5h2" />
      <line x1="10" x2="8" y1="5" y2="7" />
      <line x1="2" x2="22" y1="12" y2="12" />
      <line x1="7" x2="7" y1="19" y2="21" />
      <line x1="17" x2="17" y1="19" y2="21" />
    </svg>
  );
}
function Area(p) {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} {...iconBase} {...p}>
      <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
      <line x1="21" x2="14" y1="3" y2="10" /><line x1="3" x2="10" y1="21" y2="14" />
    </svg>
  );
}
function Heart({ filled, ...p }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} {...iconBase} fill={filled ? 'currentColor' : 'none'} {...p}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
    </svg>
  );
}

const PHOTO_GRADIENTS = {
  1: 'linear-gradient(135deg, #e8d4b8 0%, #b8966a 100%)',
  2: 'linear-gradient(135deg, #d9c5e0 0%, #8c6ea8 100%)',
  3: 'linear-gradient(135deg, #f3d9b4 0%, #c98850 100%)',
  4: 'linear-gradient(135deg, #c4d5c8 0%, #6a8b7a 100%)',
  5: 'linear-gradient(135deg, #e5d2c0 0%, #a07a5e 100%)',
  6: 'linear-gradient(135deg, #d4c8de 0%, #786899 100%)',
};

/**
 * ApêCerto apartment listing card.
 * Pass `photo` (image URL) to use a real photo; otherwise a warm
 * placeholder gradient (chosen by `photoVariant`) is shown.
 */
export function ListingCard({ listing = {}, onOpen, photo }) {
  const [saved, setSaved] = React.useState(!!listing.saved);
  const {
    title = 'Apê na Pavão',
    address = 'Moema · 5 min metrô Eucaliptos',
    price = 4200,
    beds = 2, baths = 2, sqm = 67, parking = 1,
    statusBadge = { label: 'Pronto pra morar', tone: 'orange' },
    photoVariant = 1,
    tags = ['Mobiliado', 'Decorado'],
  } = listing;

  const badgeBg = statusBadge && statusBadge.tone === 'purple' ? 'var(--ape-purple)' : 'var(--ape-orange)';
  const photoStyle = photo
    ? { backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: PHOTO_GRADIENTS[photoVariant] || PHOTO_GRADIENTS[1] };

  return (
    <article
      onClick={() => onOpen && onOpen(listing)}
      style={{
        background: '#fff',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        cursor: onOpen ? 'pointer' : 'default',
        fontFamily: 'var(--font-body)',
        transition: 'transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)',
      }}>
      <div style={{ position: 'relative', height: 220, ...photoStyle }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(31,28,26,0.35) 100%)' }} />
        <div style={{ position: 'absolute', top: 14, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {statusBadge && (
            <span style={{ padding: '5px 12px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 700, background: badgeBg, color: '#fff' }}>
              {statusBadge.label}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setSaved(s => !s); }}
            aria-label="Salvar"
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.96)', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: saved ? 'var(--ape-orange)' : 'var(--neutral-600)' }}>
            <Heart filled={saved} />
          </button>
        </div>
      </div>
      <div style={{ padding: '18px 20px 20px' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-1)' }}>
          R$ {price.toLocaleString('pt-BR')}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-3)' }}> /mês</span>
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '4px 0 2px', color: 'var(--fg-1)' }}>{title}</h3>
        <div style={{ fontSize: 13, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <MapPin /> {address}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-soft)', fontSize: 13, fontWeight: 500, color: 'var(--fg-2)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Bed /> {beds}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Bath /> {baths}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Area /> {sqm}m²</span>
          {parking ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{parking} vaga</span> : null}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {tags.map((t, i) => (
            <span key={t} style={{
              padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 600,
              background: i % 2 === 0 ? 'var(--ape-orange-100)' : 'var(--ape-purple-100)',
              color: i % 2 === 0 ? 'var(--ape-orange-700)' : 'var(--ape-purple-700)',
            }}>{t}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
