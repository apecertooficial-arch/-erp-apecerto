// ListingGrid.jsx — featured grid with filter chips
const { useState: useStateLG } = React;

const FILTERS = ['Todos', '1 dorm', '2 dorms', '3+ dorms', 'Pet friendly', 'Próx. metrô'];

function ListingGrid({ listings, onOpen }) {
  const [active, setActive] = useStateLG('Todos');

  const filtered = listings.filter(l => {
    if (active === 'Todos') return true;
    if (active === '1 dorm') return l.beds === 1;
    if (active === '2 dorms') return l.beds === 2;
    if (active === '3+ dorms') return l.beds >= 3;
    return l.tags.some(t => t.toLowerCase().includes(active.toLowerCase().split(' ')[0]));
  });

  return (
    <section className="listings" id="listings">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="eyebrow">Recém-chegados</span>
            <h2 className="section-title">Apês prontos pra você</h2>
          </div>
          <a href="#" className="link-ghost">Ver todos →</a>
        </div>
        <div className="chip-row">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`chip ${active === f ? 'chip--active' : ''}`}
              onClick={() => setActive(f)}>
              {f}
            </button>
          ))}
        </div>
        <div className="listings__grid">
          {filtered.map(l => (
            <SiteListingCard key={l.id} listing={l} onOpen={onOpen} />
          ))}
          {filtered.length === 0 && (
            <div className="empty">
              Nenhum apê com esse filtro agora — <a href="#">avise quando aparecer →</a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

window.ListingGrid = ListingGrid;
