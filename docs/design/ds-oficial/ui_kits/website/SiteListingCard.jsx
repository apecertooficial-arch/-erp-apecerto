// ListingCard.jsx — apartment card
const { useState: useStateLC } = React;

function SiteListingCard({ listing, onOpen }) {
  const [saved, setSaved] = useStateLC(listing.saved || false);
  return (
    <article className="listing" onClick={() => onOpen && onOpen(listing)}>
      <div className={`listing__photo listing__photo--${listing.photoVariant || 1}`}>
        <div className="listing__photo-overlay" />
        <div className="listing__badge-row">
          {listing.statusBadge && (
            <span className={`badge badge--${listing.statusBadge.tone || 'orange'}`}>
              {listing.statusBadge.label}
            </span>
          )}
          <button
            className={`heart-btn ${saved ? 'heart-btn--saved' : ''}`}
            onClick={(e) => { e.stopPropagation(); setSaved(s => !s); }}
            aria-label="Salvar">
            {saved ? <Icon.HeartFill width={18} height={18} /> : <Icon.Heart width={18} height={18} />}
          </button>
        </div>
        {listing.photoCount && (
          <span className="listing__photo-count">
            <Icon.Camera width={13} height={13} /> {listing.photoCount}
          </span>
        )}
      </div>
      <div className="listing__body">
        <div className="listing__price">
          R$ {listing.price.toLocaleString('pt-BR')}
          <span> /mês</span>
        </div>
        <h3 className="listing__title">{listing.title}</h3>
        <div className="listing__addr">
          <Icon.MapPin width={13} height={13} /> {listing.address}
        </div>
        <div className="listing__specs">
          <span><Icon.Bed width={15} height={15} /> {listing.beds}</span>
          <span><Icon.Bath width={15} height={15} /> {listing.baths}</span>
          <span><Icon.Area width={15} height={15} /> {listing.sqm}m²</span>
          {listing.parking && <span><Icon.Car width={15} height={15} /> {listing.parking}</span>}
        </div>
        <div className="listing__tags">
          {listing.tags.map((t, i) => (
            <span key={i} className={`tag tag--${i % 2 === 0 ? 'orange' : 'purple'}`}>{t}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

window.SiteListingCard = SiteListingCard;
