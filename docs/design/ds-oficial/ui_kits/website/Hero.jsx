// Hero.jsx — landing hero with search and trust strip
function Hero({ onSearch }) {
  return (
    <section className="hero">
      <div className="hero__grafismo" />
      <div className="container hero__inner">
        <div className="hero__copy">
          <span className="eyebrow">Imobiliária · Moema, SP</span>
          <h1 className="hero__title">
            Mude esse mês.<br />
            <span className="hero__title-accent">Sem caixa, sem pintor, sem dor.</span>
          </h1>
          <p className="hero__lead">
            Apartamentos prontos pra morar, mobiliados e decorados na região de
            Moema. A gente entrega a chave — você só leva a escova de dente.
          </p>
          <SearchBar onSearch={onSearch} />
          <div className="hero__trust">
            <span><b>120+</b> apês entregues</span>
            <span className="dot">·</span>
            <span><b>4.9</b> ★ no Google</span>
            <span className="dot">·</span>
            <span>Resposta no mesmo dia</span>
          </div>
        </div>
        <div className="hero__visual">
          <div className="hero__photo hero__photo--1" />
          <div className="hero__photo hero__photo--2">
            <span className="hero__badge">🔑 chave em 48h</span>
          </div>
          <div className="hero__photo hero__photo--3" />
        </div>
      </div>
    </section>
  );
}

window.Hero = Hero;
