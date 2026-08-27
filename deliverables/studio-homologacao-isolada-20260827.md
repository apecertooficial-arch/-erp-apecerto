# Homologação isolada do ApêCerto Studio

- Fixture local: `/studio-visual-test`, sem mutação de produção, com campanha sanitizada e quatro peças (Feed, Carrossel, Stories e Reel), 5 templates por formato e mídias fictícias de ERP.
- Fluxos observados: board com filtro de template e deep link; edição de headline e estrutura; Copilot sandbox; histórico/compare; calendário mês/semana/lista; métricas com estado vazio; biblioteca visual e seleção de formato.
- Render fixture: Feed com manifesto JPEG 1080×1350; Reel com contrato de vídeo e bloqueio de publicação quando não há MP4.
- Screenshots: `studio-fixture-desktop.png` e `studio-fixture-mobile.png`.
- Console: encontrados avisos de `src` vazio e chave ausente no calendário; corrigidos (asset sem URL agora mostra placeholder e eventos possuem `key`).
- Suíte após correção: 506/506 testes aprovados; build concluído; lint sem erros.
- Produção foi somente leitura. O serviço retornou build anterior durante o polling do novo commit; nenhuma aprovação, agendamento ou publicação real foi executada.
