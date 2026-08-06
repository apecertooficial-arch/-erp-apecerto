// QuotePost.jsx — 1080×1350 testimonial / brand voice post
function QuotePost({ quote, author, role, tone = 'orange' }) {
  const bg = tone === 'purple' ? 'var(--ape-purple)' : 'var(--ape-orange)';
  return (
    <div className="canvas-1080-1350 slide qp" style={{ background: bg }}>
      <div className={`slide__grafismo ${tone === 'purple' ? 'slide__grafismo--purple' : ''}`}
           style={{ opacity: 0.35 }} />
      <div className="qp__inner">
        <div className="qp__quote-mark">"</div>
        <p className="qp__quote">{quote}</p>
        <div className="qp__by">
          <div className="qp__avatar" />
          <div>
            <div className="qp__name">{author}</div>
            <div className="qp__role">{role}</div>
          </div>
        </div>
      </div>
      <div className="qp__footer">
        <img src="../../assets/logo-branco.png" alt="apêcerto" className="qp__logo" />
        <span className="qp__handle">@apecerto.imoveis</span>
      </div>
    </div>
  );
}

window.QuotePost = QuotePost;
