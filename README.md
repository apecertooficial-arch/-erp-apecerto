# Frontend do ERP ApêCerto

Aplicação operacional do ERP ApêCerto. CRM, Agenda, Financeiro, Automações,
Agentes de IA e demais módulos são implementados diretamente no aplicativo.

## Comandos

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

`pnpm dev` abre a aplicação local em `http://localhost:3001/`.

## Estrutura principal

- `app/`: aplicação, componentes, funcionalidades e rotas de API;
- `app/features/funil-2/`: CRM operacional canônico;
- `app/features/automations/`: Central de Automações independente de funil;
- `app/features/agents/`: treinamento e avaliação dos agentes de IA;
- `supabase/`: migrations e Edge Functions do ambiente operacional;
- `tests/`: verificações executadas antes da entrega;
- `.env.example`: modelo das variáveis públicas do Supabase.

As credenciais secretas não fazem parte do projeto. Use somente a chave pública
no frontend; nunca coloque `service_role` em variáveis `NEXT_PUBLIC_*`.
