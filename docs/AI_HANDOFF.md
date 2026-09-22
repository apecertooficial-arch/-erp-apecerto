# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `7d0b2c18`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o Meu Dia móvel mantém o relógio vivo e reclassifica prazos que vencem enquanto a tela permanece aberta.
- Decisão: atualizar apenas o estado local de tempo a cada 30 segundos, sem dependência nova nem chamada extra à API; a carga periódica dos dados continua independente a cada 45 segundos.
- Arquivos: `app/features/funil-2/Funil2Mobile.tsx`, `tests/funil-2-mobile-operacional.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: o teste falhou primeiro com `agora` congelado; no harness, um lead sanitizado passou de “Daqui a pouco”/0 aguardando para “Chamar agora”/1 aguardando sem reload; 45 testes dirigidos passaram.
- Produção: `7d0b2c18` publicado e confirmado antes desta fatia; nenhuma mutação real foi executada.
- Risco: baixo; um render local no máximo a cada 30 segundos enquanto o Meu Dia estiver montado.
- Próximo passo: executar lint e build, publicar esta fatia, validar o Meu Dia em produção sem mutação e seguir para a próxima falha P0/P1 comprovada.
