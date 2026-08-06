// CarouselSlide.jsx — 1080×1080 carousel slide, several variants
function CarouselSlide({ variant, slide }) {
  if (variant === 'title') {
    return (
      <div className="canvas-1080-1080 slide cs-title">
        <div className="slide__grafismo" />
        <div className="cs-title__inner">
          <span className="slide__eyebrow">{slide.eyebrow || 'apêcerto · moema'}</span>
          <h1 className="slide__h1" style={{ fontSize: 130 }}>
            {slide.titleLeft && <span style={{ color: 'var(--ape-orange)' }}>{slide.titleLeft}</span>}
            {slide.titleLeft && <br />}
            <span style={{ color: 'var(--ape-purple)' }}>{slide.title}</span>
          </h1>
          <p className="slide__body" style={{ color: 'var(--neutral-700)', maxWidth: 800, marginTop: 32 }}>
            {slide.subtitle}
          </p>
        </div>
        <span className="cs-page-indicator">01 / 05</span>
      </div>
    );
  }

  if (variant === 'numbered') {
    return (
      <div className="canvas-1080-1080 slide cs-numbered">
        <div className="cs-numbered__bg" />
        <div className="cs-numbered__num">{slide.n}</div>
        <div className="cs-numbered__copy">
          <h2 className="slide__h2" style={{ color: '#fff' }}>{slide.title}</h2>
          <p className="slide__body" style={{ color: 'rgba(255,255,255,0.85)', marginTop: 24 }}>
            {slide.body}
          </p>
        </div>
        <img src="../../assets/logo-branco.png" className="cs-corner-logo" alt="" />
        <span className="cs-page-indicator cs-page-indicator--light">{slide.page}</span>
      </div>
    );
  }

  if (variant === 'stat') {
    return (
      <div className="canvas-1080-1080 slide cs-stat">
        <div className="slide__grafismo slide__grafismo--faded" />
        <div className="cs-stat__inner">
          <div className="cs-stat__big">{slide.stat}</div>
          <div className="cs-stat__label">{slide.label}</div>
          <div className="cs-stat__note">{slide.note}</div>
        </div>
        <img src="../../assets/simbolo-cores.png" className="cs-stat__mark" alt="" />
      </div>
    );
  }

  if (variant === 'cta') {
    return (
      <div className="canvas-1080-1080 slide cs-cta">
        <div className="slide__grafismo slide__grafismo--purple" />
        <div className="cs-cta__inner">
          <img src="../../assets/logo-branco.png" alt="apêcerto" style={{ width: 280 }} />
          <h2 className="slide__h2" style={{ color: '#fff', marginTop: 40, fontSize: 80 }}>
            Bora ver seu apê?
          </h2>
          <p className="slide__body" style={{ color: 'rgba(255,255,255,0.85)', marginTop: 24, maxWidth: 720 }}>
            A gente responde em ~6 minutos no WhatsApp. Sem corretor robô, sem visita perdida.
          </p>
          <div className="slide__cta slide__cta--white" style={{ marginTop: 56 }}>
            <span>link na bio</span>
            <span className="arrow">→</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

window.CarouselSlide = CarouselSlide;
