"use client";

import { ProductsModule } from "../../features/products/ProductsModule";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Produtos">{(t) => <ProductsModule accessToken={t} />}</GuardaModulo>;
}
