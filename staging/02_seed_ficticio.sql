-- =====================================================================================
-- SEED FICTÍCIO PARA STAGING — dados inequivocamente falsos (NUNCA em produção).
-- Nomes iniciados por TESTE_, e-mails @example.com, telefones reservados (55 11 5550-01xx).
-- 1 admin, 1 gestor, 3 corretores, 12 leads, 12 negócios, visitas, empr./unidades, ZERO vendas.
-- Os ESTADOS Nova Era NÃO são semeados aqui: são criados pelas RPCs nos smoke tests (03).
-- =====================================================================================
\set ON_ERROR_STOP on

-- Identidades (UUIDs fictícios). Árvore: A/B -> gestor -> admin; C -> admin (FORA da equipe do gestor,
-- para provar "gestor vê somente a equipe"). Total: 1 admin, 1 gestor, 3 corretores.
INSERT INTO public.usuarios (id, nome, email, role, ativo, superior_id) VALUES
  ('aaaa0000-0000-4000-8000-000000000001','TESTE_Admin','admin@example.com','admin',true,NULL),
  ('bbbb0000-0000-4000-8000-000000000001','TESTE_Gestor','gestor@example.com','gerente',true,'aaaa0000-0000-4000-8000-000000000001'),
  ('cccc0000-0000-4000-8000-000000000001','TESTE_Corretor_A','corretor.a@example.com','corretor',true,'bbbb0000-0000-4000-8000-000000000001'),
  ('cccc0000-0000-4000-8000-000000000002','TESTE_Corretor_B','corretor.b@example.com','corretor',true,'bbbb0000-0000-4000-8000-000000000001'),
  ('cccc0000-0000-4000-8000-000000000003','TESTE_Corretor_C','corretor.c@example.com','corretor',true,'aaaa0000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Corretores (ids fixos 1=A, 2=B, 3=C). Gestor não é corretor (vê equipe via manages_broker).
INSERT INTO public.corretores (id, usuario_id, ativo) VALUES
  (1,'cccc0000-0000-4000-8000-000000000001',true),
  (2,'cccc0000-0000-4000-8000-000000000002',true),
  (3,'cccc0000-0000-4000-8000-000000000003',true)
ON CONFLICT (id) DO NOTHING;

-- 12 leads fictícios (telefones reservados 5550-01xx; e-mails example.com)
INSERT INTO public.leads (id, nome, telefone, email) VALUES
  (1 ,'TESTE_Lead_01','+55 11 95550-0101','lead01@example.com'),
  (2 ,'TESTE_Lead_02','+55 11 95550-0102','lead02@example.com'),
  (3 ,'TESTE_Lead_03','+55 11 95550-0103','lead03@example.com'),
  (4 ,'TESTE_Lead_04','+55 11 95550-0104','lead04@example.com'),
  (5 ,'TESTE_Lead_05','+55 11 95550-0105','lead05@example.com'),
  (6 ,'TESTE_Lead_06','+55 11 95550-0106','lead06@example.com'),
  (7 ,'TESTE_Lead_07','+55 11 95550-0107','lead07@example.com'),
  (8 ,'TESTE_Lead_08','+55 11 95550-0108','lead08@example.com'),
  (9 ,'TESTE_Lead_09','+55 11 95550-0109','lead09@example.com'),
  (10,'TESTE_Lead_10','+55 11 95550-0110','lead10@example.com'),
  (11,'TESTE_Lead_11','+55 11 95550-0111','lead11@example.com'),
  (12,'TESTE_Lead_12','+55 11 95550-0112','lead12@example.com')
ON CONFLICT (id) DO NOTHING;

-- 12 negócios. Cenários (estado dirigido nos smoke tests):
--  1 sem resposta · 2 respondeu · 3 visita · 4 proposta · 5 descarte · 6 nutrição ·
--  7 reativação · 8 cadência esgotada · 9 carteira de B (isolamento) ·
-- 10 transferência (começa em A, vai p/ B) · 11 corretor C FORA da equipe do gestor · 12 RPC/escrita direta.
INSERT INTO public.negocios (id, lead_id, corretor_id, status) VALUES
  (1 ,1 ,1,'aberto'),(2 ,2 ,1,'aberto'),(3 ,3 ,1,'aberto'),(4 ,4 ,1,'aberto'),
  (5 ,5 ,1,'aberto'),(6 ,6 ,1,'aberto'),(7 ,7 ,1,'aberto'),(8 ,8 ,1,'aberto'),
  (9 ,9 ,2,'aberto'),(10,10,1,'aberto'),(11,11,3,'aberto'),(12,12,1,'aberto')
ON CONFLICT (id) DO NOTHING;

-- Empreendimento/unidade fictícios (para a proposta)
INSERT INTO public.empreendimentos (id, nome) VALUES
  ('e0000000-0000-4000-8000-000000000001','TESTE_Empreendimento_Alpha') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.unidades (id, empreendimento_id) VALUES
  ('d0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001') ON CONFLICT (id) DO NOTHING;

-- Visita fictícia AGENDADA para o negócio 3 (consumida no cenário "visita sai do quadro")
INSERT INTO public.visitas (id, negocio_id, created_by, corretor_id, status, data) VALUES
  ('40000000-0000-4000-8000-000000000001',3,'aaaa0000-0000-4000-8000-000000000001',1,'agendada',current_date+2)
ON CONFLICT (id) DO NOTHING;

-- ZERO vendas (nenhum INSERT em vendas/venda_corretores).

-- Realinha as sequências de identidade após inserts explícitos (evita colisão futura)
SELECT setval(pg_get_serial_sequence('public.corretores','id'), (SELECT max(id) FROM public.corretores));
SELECT setval(pg_get_serial_sequence('public.leads','id'),      (SELECT max(id) FROM public.leads));
SELECT setval(pg_get_serial_sequence('public.negocios','id'),   (SELECT max(id) FROM public.negocios));

SELECT 'SEED_FICTICIO_OK vendas='||(SELECT count(*) FROM public.vendas) AS status;
