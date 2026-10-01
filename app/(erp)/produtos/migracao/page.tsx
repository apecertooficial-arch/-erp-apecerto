"use client";

import { ProductMigrationSelector } from "../../../features/products/ProductMigrationSelector";
import { GuardaModulo } from "../../../features/system/GuardaModulo";

export default function PaginaMigracaoProdutos() {
  return <GuardaModulo modulo="Produtos">{(token) => <ProductMigrationSelector accessToken={token} />}</GuardaModulo>;
}
