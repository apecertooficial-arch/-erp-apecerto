import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    // Edge Functions usam Deno (imports remotos e globals próprios). Elas têm
    // gate dedicado em `pnpm lint:edge`; regras Next/React geravam falsos erros.
    "supabase/functions/**",
    // Dependencias de terceiros auto-hospedadas; lintamos o adaptador
    // app/lib/opusMic.ts, não o bundle minificado do fornecedor.
    "public/_vendor/**",
    // Export estático do protótipo visual aprovado; o código do aplicativo
    // vigente mora em app/ e continua coberto pelo lint.
    "public/prototipo/**",
    // Bundle gerado do runtime do protótipo da Central. Ele é idêntico ao
    // support.js do export acima; não há código-fonte editável neste repositório.
    "public/central-comando/support.js",
    "next-env.d.ts",
    // Bundle gerado pelo harness de teste do shell — nao e codigo-fonte.
    "tests/shell/.build/**",
  ]),
]);

export default eslintConfig;
