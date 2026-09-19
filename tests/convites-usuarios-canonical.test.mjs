import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  candidatosToken,
  gerarTokenConvite,
  normalizarEmail,
  normalizarTokenConvite,
  papelAutocadastroValido,
  problemaSenha,
  tokenArmazenado,
  uuidValido,
} from "../supabase/functions/_shared/convites-policy.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const admin = read("../supabase/functions/admin-usuarios/index.ts");
const signup = read("../supabase/functions/cadastro-publico/index.ts");
const password = read("../supabase/functions/definir-senha/index.ts");
const http = read("../supabase/functions/_shared/edge-http.ts");
const config = read("../supabase/config.toml");
const team = read("../app/features/team/TeamWorkspace.tsx");
const signupPage = read("../app/cadastro/page.tsx");
const passwordPage = read("../app/definir-senha/page.tsx");

test("tokens novos possuem entropia, só o hash é persistido e links antigos continuam legíveis", async () => {
  const first = gerarTokenConvite();
  const second = gerarTokenConvite();
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
  const stored = await tokenArmazenado(first);
  assert.match(stored, /^sha256:[a-f0-9]{64}$/);
  assert.ok(!stored.includes(first));
  assert.deepEqual(await candidatosToken(first), [stored, first]);
  assert.equal(normalizarTokenConvite("curto"), "");
});

test("validações puras fecham e-mail, senha, UUID e papel de autocadastro", () => {
  assert.equal(normalizarEmail("  Pessoa@EXEMPLO.COM "), "pessoa@exemplo.com");
  assert.equal(normalizarEmail("nao-e-email"), "");
  assert.equal(problemaSenha("1234567"), "senha_curta");
  assert.equal(problemaSenha("x".repeat(73)), "senha_longa");
  assert.equal(problemaSenha("segura-123"), null);
  assert.equal(uuidValido("00000000-0000-4000-8000-000000000000"), "00000000-0000-4000-8000-000000000000");
  assert.equal(uuidValido("qualquer"), null);
  assert.equal(papelAutocadastroValido("corretor"), true);
  assert.equal(papelAutocadastroValido("admin"), false);
});

test("admin-usuarios exige JWT e papel canônico, e o navegador não grava convite", () => {
  assert.match(config, /\[functions\.admin-usuarios\][\s\S]*?verify_jwt = true/);
  assert.match(admin, /auth\.getUser\(token\)/);
  assert.match(admin, /papelNoGrupo\(profile\.role, "admin"\)/);
  assert.match(team, /action: "criarConviteCadastro"/);
  assert.doesNotMatch(team, /from\("cadastro_convites"\)\.insert/);
  assert.doesNotMatch(team, /crypto\.randomUUID/);
});

test("funções públicas têm autenticação de token customizada e origem restrita", () => {
  assert.match(config, /\[functions\.cadastro-publico\][\s\S]*?verify_jwt = false/);
  assert.match(config, /\[functions\.definir-senha\][\s\S]*?verify_jwt = false/);
  assert.match(signup, /candidatosToken\(rawToken\)/);
  assert.match(password, /candidatosToken\(rawToken\)/);
  assert.match(http, /ERP_ALLOWED_ORIGINS/);
  assert.doesNotMatch(http, /Access-Control-Allow-Origin"\s*:\s*"\*"/);
});

test("autocadastro reserva o convite antes de criar usuário e compensa falhas", () => {
  const reserve = signup.indexOf("const reservedAt = await reserveInvite");
  const create = signup.indexOf("admin.auth.admin.createUser");
  assert.ok(reserve > -1 && create > reserve);
  assert.match(signup, /\.is\("usado_em", null\)[\s\S]*?\.gt\("expira_em", reservedAt\)/);
  assert.match(signup, /releaseInvite\(invite\.id, reservedAt\)/);
  assert.match(signup, /rollbackUser\(userId, broker\.id\)/);
  assert.match(signup, /role: "corretor"/);
});

test("definição de senha consome uma única vez antes da mutação privilegiada", () => {
  const reserve = password.indexOf("const reservedAt = await reserveInvite");
  const update = password.indexOf("admin.auth.admin.updateUserById");
  assert.ok(reserve > -1 && update > reserve);
  assert.match(password, /\.is\("usado_em", null\)[\s\S]*?\.gt\("expira_em", reservedAt\)/);
  assert.match(password, /if \(error\)[\s\S]*?releaseInvite\(invite\.id, reservedAt\)/);
});

test("novos convites nunca persistem o segredo e erros internos são sanitizados", () => {
  assert.match(admin, /token: await tokenArmazenado\(rawToken\)/);
  assert.doesNotMatch(admin + signup + password, /detalhe:\s*(?:error|\w+Error)\.message/);
  assert.doesNotMatch(admin + signup + password, /String\((?:error|err|e)\)/);
  assert.match(http, /Cache-Control": "private, no-store"/);
});

test("páginas removem o token da URL e limitam senha antes de enviar", () => {
  for (const page of [signupPage, passwordPage]) {
    assert.match(page, /history\.replaceState\(window\.history\.state, "", window\.location\.pathname\)/);
    assert.match(page, /senha\.length > 72/);
    assert.match(page, /maxLength=\{72\}/);
  }
  assert.doesNotMatch(passwordPage, /useState\(\(\) => typeof window/);
  assert.match(passwordPage, /const \[token, setToken\] = useState\(""\)/);
});
