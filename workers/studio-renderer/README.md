# apêcerto Studio renderer

Worker separado do frontend. Ele consome apenas jobs persistidos do tipo
`render`, baixa originais autorizados com a service role, gera JPEG ou MP4
com FFmpeg, valida o arquivo com FFprobe e decodificação completa, grava no
bucket privado `social-studio` e conclui tudo por uma RPC transacional.

O processo fica inerte se faltar qualquer configuração:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STUDIO_RENDERER_WORKER_ID`
- `STUDIO_RENDERER_ORGANIZATION_ID`
- `STUDIO_FFMPEG_PATH`
- `STUDIO_FFPROBE_PATH`
- `STUDIO_LOGO_PATH`
- `STUDIO_FONT_PATH`

Execute uma unidade de trabalho com `node workers/studio-renderer/index.mjs`.
O agendador da infraestrutura pode repetir essa execução; a claim usa
`FOR UPDATE SKIP LOCKED` e o arquivo final tem caminho por checksum.

FFmpeg/FFprobe não são empacotados neste repositório. A infraestrutura deve
fornecer binários auditados e compatíveis com a licença escolhida.
