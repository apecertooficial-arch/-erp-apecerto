// HowItWorks.jsx — 3-step explainer
function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'A gente seleciona',
      body: 'Visitamos cada apartamento, testamos chuveiro, internet, vizinhança. Só entra na vitrine o que a gente moraria.',
      icon: '🏡',
    },
    {
      n: '02',
      title: 'A gente decora',
      body: 'Mobília escolhida por uma designer que sabe o que faz. Da panela ao quadro, tudo pronto pra você se mudar amanhã.',
      icon: '🛋️',
    },
    {
      n: '03',
      title: 'Você se muda',
      body: 'Assinatura digital, vistoria em 30 min, chave em até 48h. Sem corretor sumido, sem pintor, sem dor de cabeça.',
      icon: '🔑',
    },
  ];

  return (
    <section className="how" id="como">
      <div className="how__grafismo" />
      <div className="container">
        <div className="section-head section-head--centered">
          <span className="eyebrow">Como funciona</span>
          <h2 className="section-title">Três passos pra chave na mão.</h2>
        </div>
        <div className="how__grid">
          {steps.map(s => (
            <div className="how__step" key={s.n}>
              <div className="how__icon">{s.icon}</div>
              <div className="how__n">{s.n}</div>
              <h3 className="how__title">{s.title}</h3>
              <p className="how__body">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

window.HowItWorks = HowItWorks;
