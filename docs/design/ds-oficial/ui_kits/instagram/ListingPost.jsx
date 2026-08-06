// ListingPost.jsx — 1080×1350 feed post for a new apartment
function ListingPost({ listing, photoVariant = 1 }) {
  return (
    <div className="canvas-1080-1350 slide listing-post">
      <div className={`listing-post__photo listing-post__photo--${photoVariant}`}>
        <div className="listing-post__photo-overlay" />
        <div className="listing-post__top">
          <img src="../../assets/logo-branco.png" alt="apêcerto" className="listing-post__logo" />
          <span className="listing-post__pill">novo apê</span>
        </div>
        <div className="listing-post__photo-caption">📷 {listing.photoCount} fotos no link da bio</div>
      </div>
      <div className="listing-post__card">
        <div className="listing-post__row">
          <div>
            <div className="listing-post__title">{listing.title}</div>
            <div className="listing-post__addr">📍 {listing.address}</div>
          </div>
          <div className="listing-post__price">
            <span className="big">R$ {listing.price.toLocaleString('pt-BR')}</span>
            <span className="unit">/mês · cond. incluso</span>
          </div>
        </div>
        <div className="listing-post__specs">
          <div className="lp-spec"><div className="k">{listing.beds}</div><div className="v">dorms</div></div>
          <div className="lp-spec"><div className="k">{listing.baths}</div><div className="v">banhos</div></div>
          <div className="lp-spec"><div className="k">{listing.sqm}</div><div className="v">m²</div></div>
          <div className="lp-spec"><div className="k">{listing.parking || 1}</div><div className="v">vaga</div></div>
        </div>
        <div className="listing-post__tags">
          {listing.tags.map((t, i) => (
            <span key={t} className={`lp-tag ${i % 2 === 0 ? 'orange' : 'purple'}`}>{t}</span>
          ))}
        </div>
        <div className="listing-post__cta">
          <span>Chave em 48h.</span>
          <span className="arrow">link na bio →</span>
        </div>
      </div>
    </div>
  );
}

window.ListingPost = ListingPost;
