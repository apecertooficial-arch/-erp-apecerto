# Gate externo — remediação de Produtos

Este runbook prepara a execução; não autoriza nem executa produção.

## Candidata local

- ERP base final: `f0a6a991d0923e5a15bbc1cfeaa7b995edfbfd64`, confirmado simultaneamente em `origin/main` e no endpoint público `/api/build`.
- Candidata integrada: branch local `codex/produtos-remediacao-candidata-20260828`; a branch antiga sobre `2627627` é somente histórico e não pode ser publicada.
- Migrations: A expansão do contrato; B cutover ACL; C perfil ativo; D RPC canônica/lockdown; E Storage privado.
- Site: aplicar o commit local do site somente depois de A/B e validar ficha/404.

## Backup obrigatório

1. Reconfirmar project ref e que o destino é produção imediatamente antes do comando.
2. Confirmar PITR/backup automático restaurável e registrar responsável e RTO.
3. Criar backup adicional pelo mecanismo oficial do projeto, com validação de restauração em clone/preview isolado.
4. Salvar schema-only e snapshots de views, grants, policies, funções, bucket e migration history. Gerar o SQL de restauração com `psql -XAt -v ON_ERROR_STOP=1 -f supabase/preflight/produtos_remediacao_snapshot_restore.sql > <arquivo-protegido>`; validar o arquivo num clone isolado e registrar SHA-256/caminho no ticket do rollout.
5. Não prosseguir se não houver restauração comprovada ou se o backup puder sobrescrever escritas legítimas posteriores.

## Preflight

Executar `supabase/preflight/produtos_remediacao_preflight.sql` em modo read-only. Capturar somente métricas agregadas. O snapshot restaurável B/E é obrigatório e deve ser gerado pelo arquivo complementar acima; sem validação em clone e hash registrado, o gate permanece fechado. Abortar por schema divergente, lock/DDL concorrente, path órfão inexplicado, MIME/tamanho incompatível, PII no contrato, hash divergente ou consumer ainda usando URL pública direta.

Fingerprints conhecidos da coauditoria (28/08/2026):

- 64 empreendimentos — `bab17e4fc005744f9863f824a9d52396`;
- 289 unidades — `a3262e651e9831858074755b725e003c`;
- 2.117 mídias — `de821a9b39ae9e3691cf80e3dc6c7271`;
- 53 linhas no contrato público seguro; zero lock aguardando.

Os hashes do preflight usam SHA-256 e uma composição nova, portanto servem para comparação antes/depois desta execução, não para comparação textual direta com os fingerprints legados acima.

## Rollout

1. Migration A; verificar shape, contagens e endereço público sem dígito.
2. Migration B; provar anon negado nas bases/view legada e views suportadas 200.
3. Site; verificar ficha, cinco fotos, token inválido 404, MIME HTML da rota inexistente.
4. ERP; verificar mídia assinada, nenhuma URL pública direta e RPC canônica.
5. Migration C; matriz ativo/inativo.
6. Migration D; canonical passa, todos os overloads legados ficam negados.
7. Migration E; somente após inventário MIME/tamanho e smoke privado em ambiente isolado.
8. Matriz visitante/captador/não captador/gestor e monitoramento 4xx/5xx por etapa.

## Rollback e roll-forward

- A: restaurar a definição anterior da view; preservar a coluna gerada.
- B: preferir corrigir grants por roll-forward. Reabrir ACL somente a partir do snapshot desta execução e com autorização de incidente.
- C: rollback conservador restaura leitura authenticated; nunca reabre anon.
- D: regrant temporário somente das duas assinaturas registradas.
- E: preferir corrigir policy/consumer. Tornar o bucket público novamente reabre exposição e exige autorização de incidente e snapshot.
- Nunca usar `DROP COLUMN`, apagar objetos, DML em imóveis ou restauração integral sem conciliar escritas posteriores.

## Previews preparados

Os commits locais são reproduzíveis em branches `codex/produtos-remediacao-local-20260828`. Para preview externo, fazer push somente após autorização, criar previews apontando para banco isolado e bloquear por hostname/project ref qualquer conexão à produção. Não criar Auth: usar o smoke mockado já versionado ou sessões sintéticas previamente autorizadas.

## Reconciliação histórica

O handoff anterior registrou 288→289 unidades e 2.077→2.117 mídias em datas distintas. A coauditoria posterior provou 289/2.117 tanto no início quanto no fim, com fingerprints preservados. Como esta fase local não conectou nem escreveu no banco e as migrations A–E não executam DML comercial ao serem aplicadas, esse delta é estado concorrente anterior entre observações, não efeito desta remediação.

Quanto à OpenAI, os artefatos locais disponíveis provam quota 429, flag desligada e **zero chamada nesta coauditoria/fase local**. Eles não permitem provar retroativamente se a entrega anterior fez uma ou duas tentativas. O número histórico permanece **inconclusivo**; nenhuma inferência foi usada.
