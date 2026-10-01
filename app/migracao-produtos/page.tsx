"use client";

import { ProductMigrationSelector } from "../features/products/ProductMigrationSelector";
import { GuardaModulo } from "../features/system/GuardaModulo";
import { ErpSessionProvider } from "../features/system/ErpSession";

export default function PaginaMigracaoProdutos() {
  return (
    <ErpSessionProvider>
      <GuardaModulo modulo="Produtos">
        {(token) => <ProductMigrationSelector accessToken={token} />}
      </GuardaModulo>
    </ErpSessionProvider>
  );
}
