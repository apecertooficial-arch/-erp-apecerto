// StoryPost.jsx — 1080×1920 story with sticker overlay variants
function StoryPost({ variant, data }) {
  if (variant === 'listing') {
    return (
      <div className="canvas-1080-1920 slide story story--listing">
        <div className={`story__bg story__bg--${data.photoVariant || 1}`} />
        <div className="story__overlay" />
        <div className="story__top">
          <div className="story__progress">
            <span className="story__progress-bar story__progress-bar--active" />
            <span className="story__progress-bar" />
            <span className="story__progress-bar" />
          </div>
          <div className="story__handle">
            <img src="../../assets/simbolo-cores.png" alt="" />
            <span>apecerto.imoveis</span>
            <span className="story__time">2h</span>
          </div>
        </div>
        <div className="story__sticker story__sticker--rotate">
          <span className="story__sticker-eyebrow">NOVO APÊ</span>
          <span className="story__sticker-big">R$ {data.price.toLocaleString('pt-BR')}</span>
          <span className="story__sticker-unit">/mês · cond. incluso</span>
        </div>
        <div className="story__bottom">
          <div className="story__title">{data.title}</div>
          <div className="story__addr">📍 {data.address}</div>
          <div className="story__specs">
            <span>🛏 {data.beds} dorms</span>
            <span>📐 {data.sqm}m²</span>
            <span>🛋 mobiliado</span>
          </div>
          <div className="story__swipe">
            <span className="story__swipe-arrow">↑</span>
            <span>arrasta pra ver</span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'poll') {
    return (
      <div className="canvas-1080-1920 slide story story--poll">
        <div className="story__bg story__bg--gradient" />
        <div className="slide__grafismo slide__grafismo--faded" style={{ opacity: 0.15 }} />
        <div className="story__top">
          <div className="story__progress">
            <span className="story__progress-bar" />
            <span className="story__progress-bar story__progress-bar--active" />
            <span className="story__progress-bar" />
          </div>
        </div>
        <div className="story__poll-inner">
          <div className="story__poll-q">
            <span style={{ color: 'var(--ape-orange)' }}>Apê dos sonhos:</span><br />
            mobiliado<br />ou vazio?
          </div>
          <div className="story__poll">
            <div className="story__poll-bar" style={{ width: '78%' }}>
              <span>🛋 mobiliado</span><span>78%</span>
            </div>
            <div className="story__poll-bar story__poll-bar--alt" style={{ width: '22%' }}>
              <span>📦 vazio</span><span>22%</span>
            </div>
          </div>
          <div className="story__poll-foot">2.1k votos</div>
        </div>
        <div className="story__brand-foot">
          <img src="../../assets/logo-branco.png" alt="" />
        </div>
      </div>
    );
  }

  if (variant === 'tip') {
    return (
      <div className="canvas-1080-1920 slide story story--tip">
        <div className="story__bg story__bg--orange" />
        <div className="slide__grafismo" style={{ opacity: 0.6, mixBlendMode: 'overlay' }} />
        <div className="story__top">
          <div className="story__progress">
            <span className="story__progress-bar" />
            <span className="story__progress-bar" />
            <span className="story__progress-bar story__progress-bar--active" />
          </div>
        </div>
        <div className="story__tip-inner">
          <span className="story__tip-eyebrow">DICA DE MUDANÇA · 03</span>
          <div className="story__tip-h">
            Não compre cama nova<br />
            <span style={{ color: 'var(--ape-purple)' }}>no primeiro dia.</span>
          </div>
          <div className="story__tip-body">
            Durma uma semana no apê antes. Você vai descobrir se quer king, queen, ou se a cabeceira do vizinho faz barulho às 6h.
          </div>
        </div>
        <div className="story__brand-foot">
          <img src="../../assets/logo-branco.png" alt="" />
          <span>+ 14 dicas no destaque "mudança"</span>
        </div>
      </div>
    );
  }

  return null;
}

window.StoryPost = StoryPost;
