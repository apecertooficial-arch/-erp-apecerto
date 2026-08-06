// Footer.jsx — newsletter + nav
function Footer() {
  return (
    <footer className="site-footer" id="contato">
      <div className="container site-footer__inner">
        <div className="site-footer__lead">
          <img src="../../assets/logo-branco.png" alt="apêcerto" className="site-footer__logo" />
          <h3 className="site-footer__h">
            Quer ser o primeiro a ver os apês novos?
          </h3>
          <p>A gente manda no WhatsApp toda quarta. Nada de spam, nada de promoção.</p>
          <form className="newsletter" onSubmit={(e) => e.preventDefault()}>
            <input placeholder="11 99999-0000" type="tel" />
            <button className="btn btn-primary" type="submit">Me avisa</button>
          </form>
        </div>
        <div className="site-footer__cols">
          <div>
            <div className="site-footer__col-h">Apês</div>
            <a href="#">Recém-chegados</a>
            <a href="#">Mobiliados</a>
            <a href="#">Pet friendly</a>
            <a href="#">Investimento</a>
          </div>
          <div>
            <div className="site-footer__col-h">A gente</div>
            <a href="#">Como funciona</a>
            <a href="#">Bairro Moema</a>
            <a href="#">Anunciar</a>
            <a href="#">Trabalhe com a gente</a>
          </div>
          <div>
            <div className="site-footer__col-h">Fale conosco</div>
            <a href="#">WhatsApp</a>
            <a href="#">Instagram</a>
            <a href="#">contato@apecerto.com</a>
            <a href="#">+55 11 98765-4321</a>
          </div>
        </div>
      </div>
      <div className="site-footer__base">
        <span>© 2026 ApêCerto · Imobiliária Moema</span>
        <span>CRECI 12345-J · CNPJ 00.000.000/0001-00</span>
      </div>
    </footer>
  );
}

window.Footer = Footer;
