# Protótipo aprovado — app mobile apêcerto

`app-apecerto-mobile.html` é o protótipo navegável aprovado do redesign mobile (identidade apêcerto), em um único arquivo HTML auto-contido — abre direto no navegador, sem build.

Com o deploy, fica disponível em `/prototipo/app-apecerto-mobile.html`.

## Como navegar
- Rail da esquerda: pula entre as 8 telas, troca o perfil (corretor / gestor) e liga os 6 estados de sistema (normal, carregando, vazio, erro, offline, sessão expirada).
- **Chamar no WhatsApp**: roda o fluxo real — aberto → aguardando sincronização → confirmado (verde só quando a integração confirma).

## Regras de produto preservadas
- Clique no WhatsApp não confirma contato; só a integração oficial confirma.
- Sara orienta, nunca envia.
- Concluir tarefa ≠ contato realizado.
- Sem vocabulário técnico na tela do corretor.
- Alvos de toque ≥ 44 px, safe-area superior e inferior.

Este arquivo é referência de visualização e funcionamento — não é código de produção.
