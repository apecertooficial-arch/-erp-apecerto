# Frontend do ERP ApêCerto

Aplicação local que hospeda o ERP integrado, mantém o HTML original preservado
e acrescenta as telas e conexões atuais.

## Comandos

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

`pnpm dev` executa primeiro a sincronização do HTML. A aplicação abre em
`http://localhost:3001/`.

## Estrutura principal

- `app/`: aplicação, componentes, funcionalidades e rotas de API;
- `public/legacy-runtime.html`: ERP integrado exibido na prévia;
- `public/legacy-assets/`: recursos necessários ao HTML;
- `scripts/`: preservação e geração do HTML integrado;
- `tests/`: verificações executadas antes da entrega;
- `.env.example`: modelo das variáveis públicas do Supabase.

As credenciais secretas não fazem parte do projeto. Use somente a chave pública
no frontend; nunca coloque `service_role` em variáveis `NEXT_PUBLIC_*`.
