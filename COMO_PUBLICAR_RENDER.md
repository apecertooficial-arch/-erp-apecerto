# Como publicar o ERP ApeCerto no seu dominio (Render.com)

Este ERP e um app de servidor (Next.js). Ele nao e um arquivo que se
arrasta pronto — ele precisa ser buildado e rodado num servidor. O Render
faz isso de graca e atualiza sozinho a cada mudanca.

Voce vai precisar de 3 contas gratuitas: GitHub, Render e o seu Supabase
(que voce ja tem).

--------------------------------------------------------------------
PASSO 1 — Colocar o codigo no GitHub
--------------------------------------------------------------------
1. Crie uma conta em github.com (se nao tiver).
2. Clique no + (canto superior direito) > New repository.
3. De um nome (ex.: erp-apecerto), marque "Private", clique Create.
4. Na pagina do repositorio novo, clique em "uploading an existing file".
5. Arraste TODOS os arquivos desta pasta (o conteudo do zip) para a area.
   - Importante: arraste o CONTEUDO, nao a pasta. O arquivo package.json
     e o render.yaml precisam ficar na raiz do repositorio.
6. Clique "Commit changes".

(Alternativa mais facil: instale o "GitHub Desktop", arraste a pasta,
 e clique Publish. Faz o mesmo sem mexer em site.)

--------------------------------------------------------------------
PASSO 2 — Conectar no Render
--------------------------------------------------------------------
1. Crie conta em render.com (pode entrar com o GitHub).
2. Clique em New + > Blueprint.
3. Selecione o repositorio que voce criou. O Render le o arquivo
   render.yaml automaticamente e ja configura o build.
4. Ele vai pedir as variaveis de ambiente (Passo 3).

--------------------------------------------------------------------
PASSO 3 — Colar as variaveis (chaves do Supabase)
--------------------------------------------------------------------
Cole exatamente estes valores quando o Render pedir:

NEXT_PUBLIC_SUPABASE_URL
https://diaegvfveqezispcthwk.supabase.co

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
sb_publishable_XBKx0SvGtHzTw7b5Uv0ujg_-PplKn-D

(A terceira, NEXT_PUBLIC_APECERTO_DATA_MODE, ja vem preenchida.)

Clique em "Apply" / "Create". O primeiro build comeca sozinho.

--------------------------------------------------------------------
PASSO 4 — Ver funcionando
--------------------------------------------------------------------
- O primeiro deploy leva ~5 a 15 min (o tempo do build).
- Quando terminar, o Render te da um endereco tipo
  https://apecerto-erp.onrender.com — abra e teste o login.

--------------------------------------------------------------------
PASSO 5 — Apontar o SEU dominio
--------------------------------------------------------------------
1. No painel do servico no Render: Settings > Custom Domains > Add.
2. Digite seu dominio (ex.: erp.seusite.com.br).
3. O Render mostra um registro DNS (um CNAME). Copie.
4. No painel onde voce comprou o dominio (Registro.br, GoDaddy, etc.),
   crie esse registro CNAME apontando pro endereco do Render.
5. Espera propagar (minutos ate algumas horas). Pronto.

--------------------------------------------------------------------
COMO EDITAR DEPOIS DE PUBLICADO
--------------------------------------------------------------------
Voce NAO edita direto no site publicado. O fluxo e:
  1. Edita o codigo (na sua maquina ou no Claude designer).
  2. Sobe a mudanca pro GitHub (git push, ou pelo GitHub Desktop: Commit > Push).
  3. O Render detecta e reconstroi sozinho. Em ~2-5 min o site atualiza.

Ou seja: editar -> enviar pro GitHub -> Render republica automatico.
