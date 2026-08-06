// Header.jsx — sticky nav with backdrop blur
const { useState, useEffect } = React;

function Header() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
      <div className="container site-header__inner">
        <a href="#" className="site-header__logo">
          <img src="../../assets/logo-cores.png" alt="apêcerto" />
        </a>
        <nav className="site-header__nav">
          <a href="#listings">Apês</a>
          <a href="#como">Como funciona</a>
          <a href="#bairro">Moema</a>
          <a href="#contato">Contato</a>
        </nav>
        <div className="site-header__actions">
          <a href="#" className="link-ghost">Anunciar</a>
          <a href="#contato" className="btn btn-primary btn-sm">Falar com a gente</a>
        </div>
      </div>
    </header>
  );
}

window.Header = Header;
