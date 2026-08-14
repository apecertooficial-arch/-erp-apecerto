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
    "public/legacy-assets/**",
    // Dependencias de terceiros auto-hospedadas; lintamos o adaptador
    // app/lib/opusMic.ts, não o bundle minificado do fornecedor.
    "public/_vendor/**",
    "next-env.d.ts",
    // Bundle gerado pelo harness de teste do shell — nao e codigo-fonte.
    "tests/shell/.build/**",
  ]),
]);

export default eslintConfig;
