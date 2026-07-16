"use client";

// Anti-cache: gera um valor uma vez por carregamento de pagina, forcando o iframe
// a sempre buscar a versao mais nova do ERP legado (evita ficar preso em cache).
const CACHE_BUST = Date.now();

export function OriginalErpHost() {
  return (
    <main className="original-erp-host">
      <iframe
        src={`/legacy/CRM_ApeCerto_FINAL.html?v=${CACHE_BUST}`}
        title="ERP ApêCerto — HTML final original"
      />
    </main>
  );
}
