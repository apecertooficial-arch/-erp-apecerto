// Testimonial.jsx — quote card
function Testimonial() {
  return (
    <section className="testimonial">
      <div className="container">
        <div className="testimonial__card">
          <div className="testimonial__quote-mark">"</div>
          <blockquote className="testimonial__quote">
            Cheguei de mudança de SP no domingo. Segunda já tava dormindo no apê
            com lençol limpo, café na cozinha e a Bia respondendo no WhatsApp.
            Esse é o tipo de serviço que devia existir pra tudo.
          </blockquote>
          <div className="testimonial__by">
            <div className="testimonial__avatar" />
            <div>
              <div className="testimonial__name">Mariana Tavares</div>
              <div className="testimonial__role">Mudou pra Moema em março</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

window.Testimonial = Testimonial;
