# Protótipo aprovado — app mobile apêcerto

Versão de visualização e funcionamento do redesign mobile, na identidade apêcerto.

Com o deploy, abre em **`/prototipo/`** (arquivo `index.html`). Também funciona servindo esta pasta com qualquer servidor estático.

## Arquivos
- `index.html` — o protótipo navegável (telas, perfis e estados).
- `support.js` — runtime que renderiza a página (React via CDN).
- `_ds/…` — tokens e componentes do design system apêcerto (Quicksand via Google Fonts).
- Logo e ícones vêm de `/brand` e `/icons`, já existentes no repositório.

## Como navegar
- Rail da esquerda: pula entre as 8 telas, troca o perfil (corretor / gestor) e liga os 6 estados de sistema (normal, carregando, vazio, erro, offline, sessão expirada).
- **Chamar no WhatsApp**: roda o fluxo real — aberto → aguardando sincronização → confirmado (verde só quando a integração confirma).

## Regras de produto preservadas
- Clique no WhatsApp não confirma contato; só a integração oficial confirma.
- Sara orienta, nunca envia.
- Concluir tarefa ≠ contato realizado.
- Sem vocabulário técnico na tela do corretor.
- Alvos de toque ≥ 44 px, safe-area superior e inferior.

Este material é referência de design — não é código de produção.
