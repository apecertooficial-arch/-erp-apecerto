// ListingDetailSheet.jsx — slide-up listing detail panel
function ListingDetailSheet({ listing, onClose }) {
  if (!listing) return null;
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="sheet__close" onClick={onClose} aria-label="Fechar">
          <Icon.Close width={18} height={18} />
        </button>
        <div className={`sheet__hero sheet__hero--${listing.photoVariant || 1}`}>
          <div className="sheet__hero-overlay" />
          <div className="sheet__hero-content">
            <span className="badge badge--orange">{listing.statusBadge?.label || 'Pronto pra morar'}</span>
            <h1 className="sheet__title">{listing.title}</h1>
            <div className="sheet__addr"><Icon.MapPin width={16} height={16} /> {listing.address}</div>
          </div>
        </div>
        <div className="sheet__body">
          <div className="sheet__col">
            <div className="sheet__price">
              <span className="sheet__price-big">R$ {listing.price.toLocaleString('pt-BR')}</span>
              <span className="sheet__price-unit">/mês</span>
            </div>
            <div className="sheet__price-detail">
              condomínio R$ {listing.condo} · IPTU incluso
            </div>
            <div className="sheet__specs">
              <div className="spec"><Icon.Bed width={22} height={22} /><div className="spec__k">{listing.beds}</div><div className="spec__v">dorms</div></div>
              <div className="spec"><Icon.Bath width={22} height={22} /><div className="spec__k">{listing.baths}</div><div className="spec__v">banhos</div></div>
              <div className="spec"><Icon.Area width={22} height={22} /><div className="spec__k">{listing.sqm}</div><div className="spec__v">m²</div></div>
              <div className="spec"><Icon.Car width={22} height={22} /><div className="spec__k">{listing.parking || 1}</div><div className="spec__v">vaga</div></div>
            </div>
            <p className="sheet__desc">
              {listing.description || 'Apê mobiliado por uma designer que sabe o que faz. Cozinha equipada, internet 600 mega, ar-split nos quartos. Janelão pro sol da manhã.'}
            </p>
            <div className="sheet__tags">
              {['Mobiliado', 'Decorado', 'Pet friendly', '5 min metrô', 'Vaga coberta'].map(t => (
                <span className="tag tag--neutral" key={t}>{t}</span>
              ))}
            </div>
          </div>
          <div className="sheet__sidebar">
            <div className="sheet__cta-card">
              <div className="sheet__cta-h">Quer ver pessoalmente?</div>
              <p>A gente leva você no apê hoje ainda. Resposta no WhatsApp em até 10 min.</p>
              <button className="btn btn-primary btn-lg" style={{ width: '100%' }}>Agendar visita →</button>
              <button className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }}>WhatsApp direto</button>
              <div className="sheet__broker">
                <div className="sheet__avatar" />
                <div>
                  <div className="sheet__broker-name">Bia · sua broker</div>
                  <div className="sheet__broker-meta">responde em ~6min</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ListingDetailSheet = ListingDetailSheet;
