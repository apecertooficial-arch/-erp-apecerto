// NeighborhoodCard.jsx — Moema spotlight
function NeighborhoodCard() {
  const facts = [
    { k: '5 min', v: 'do metrô Eucaliptos' },
    { k: '900 m', v: 'do Parque Ibirapuera' },
    { k: '180+', v: 'restaurantes a pé' },
    { k: '12', v: 'pet shops no bairro' },
  ];
  return (
    <section className="bairro" id="bairro">
      <div className="container bairro__inner">
        <div className="bairro__copy">
          <span className="eyebrow">O bairro</span>
          <h2 className="section-title">
            Moema é <span className="brand-ape">arborizada</span>, <span className="brand-certo">caminhável</span> e do tamanho certo.
          </h2>
          <p className="body">
            A gente escolheu Moema porque é o bairro que entrega vida lá fora —
            padaria boa, vizinhança calma, metrô perto, Ibirapuera no quintal. 
            Você não precisa ir longe pra viver bem.
          </p>
          <a href="#" className="btn btn-secondary">Conhecer o bairro →</a>
        </div>
        <div className="bairro__facts">
          {facts.map((f, i) => (
            <div className="fact" key={i}>
              <div className="fact__k">{f.k}</div>
              <div className="fact__v">{f.v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

window.NeighborhoodCard = NeighborhoodCard;
