# ERP Apecerto — Projeto completo (para edição)

Este pacote contém **100% do código-fonte e de todas as funções** do ERP:
- 35 telas/componentes React em `app/features/…`
- 17 rotas de API em `app/api/…`
- Todo o design (2.087 linhas de CSS) em `app/globals.css`
- Menu/layout em `app/components/`
- Configs, worker, banco (drizzle) e scripts

## O que NÃO vem no zip (de propósito)
- `node_modules/` (805 MB) — é a pasta de dependências. **Não é código do ERP**; é gerada automaticamente com um comando.
- `.next/` — cache de build, também gerado automaticamente.
- `.git/` — removido por segurança (continha credencial de acesso ao GitHub).

Nada de função foi retirado. Só o que qualquer editor recria sozinho.

## Como rodar e editar (passo a passo)
Requisitos: Node 20+ e pnpm.

```bash
pnpm install        # instala as dependências (recria node_modules)
pnpm dev            # abre o ERP em http://localhost:3000
```

Para editar o VISUAL: mexa em `app/globals.css` (classes como .product-card, .finance-workspace, .app-shell, .perms-matrix).
Para editar TELAS: arquivos em `app/features/<módulo>/`.

## Variáveis de ambiente (para conectar no Supabase real)
Crie um arquivo `.env` com:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```
Sem isso, o app abre mas não conecta nos dados. As chaves ficam no painel do Supabase (Project Settings → API).
