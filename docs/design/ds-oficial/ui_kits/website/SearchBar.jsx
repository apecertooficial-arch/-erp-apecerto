// SearchBar.jsx — bairro / dorms / preço search pill
const { useState: useStateSB } = React;

function SearchBar({ onSearch }) {
  const [bairro, setBairro] = useStateSB('Moema');
  const [dorms, setDorms] = useStateSB('2 dorms');
  const [price, setPrice] = useStateSB('Até R$ 5.000');

  return (
    <div className="searchbar">
      <div className="searchbar__field">
        <span className="searchbar__label">Bairro</span>
        <select value={bairro} onChange={e => setBairro(e.target.value)}>
          <option>Moema</option>
          <option>Vila Mariana</option>
          <option>Vila Nova Conceição</option>
          <option>Indianópolis</option>
        </select>
      </div>
      <div className="searchbar__divider" />
      <div className="searchbar__field">
        <span className="searchbar__label">Dorms</span>
        <select value={dorms} onChange={e => setDorms(e.target.value)}>
          <option>1 dorm</option>
          <option>2 dorms</option>
          <option>3+ dorms</option>
        </select>
      </div>
      <div className="searchbar__divider" />
      <div className="searchbar__field">
        <span className="searchbar__label">Aluguel até</span>
        <select value={price} onChange={e => setPrice(e.target.value)}>
          <option>Até R$ 3.000</option>
          <option>Até R$ 5.000</option>
          <option>Até R$ 8.000</option>
          <option>Sem limite</option>
        </select>
      </div>
      <button className="btn btn-primary searchbar__cta" onClick={() => onSearch && onSearch({ bairro, dorms, price })}>
        Ver apês →
      </button>
    </div>
  );
}

window.SearchBar = SearchBar;
