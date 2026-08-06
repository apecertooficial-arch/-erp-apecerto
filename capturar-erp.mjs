import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const EMAIL = process.env.ERP_EMAIL;
const SENHA = process.env.ERP_SENHA;
if (!EMAIL || !SENHA) {
  throw new Error('Defina ERP_EMAIL e ERP_SENHA antes de rodar.');
}

const isDepois = process.argv.includes('--depois');
const pastaSaida = path.join('erp-copia', isDepois ? 'depois' : 'antes');
if (!fs.existsSync(pastaSaida)) {
  fs.mkdirSync(pastaSaida, { recursive: true });
}

const ROTAS = [
  'inicio', 'crm', 'performance', 'produtos', 'financeiro',
  'equipe', 'abordagens', 'automacoes', 'financiamento', 'chat',
  'disparos', 'agenda', 'tarefas', 'agentes-ia', 'conhecimento',
  'usuarios', 'permissoes', 'configuracoes', 'auditoria',
  'notificacoes', 'ajuda',
];

async function run() {
  console.log(`Iniciando captura (${isDepois ? 'DEPOIS' : 'ANTES'}) para ${ROTAS.length} rotas...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  await page.goto('http://localhost:3000/inicio', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const hasAuthForm = await page.locator('input[type="email"], input[name="email"]').count();
  if (hasAuthForm > 0) {
    console.log('Formulário de login detectado. Realizando autenticação...');
    await page.fill('input[type="email"], input[name="email"]', EMAIL);
    await page.fill('input[type="password"], input[name="senha"]', SENHA);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
  }

  const postAuthForm = await page.locator('input[type="email"], input[name="email"]').count();
  if (postAuthForm > 0) {
    console.error('ERRO: Falha ao autenticar no ERP.');
    await browser.close();
    process.exit(1);
  }

  const relatorio = [];
  for (const rota of ROTAS) {
    const targetUrl = `http://localhost:3000/${rota}`;
    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(3500);

      const texto = await page.evaluate(() => document.body.innerText.length);
      const carregando = await page.evaluate(() => /carregando/i.test(document.body.innerText));
      const status = carregando ? 'PRESA EM CARREGANDO'
                   : texto < 1500 ? 'QUASE VAZIA'
                   : 'ok';

      await page.screenshot({ path: path.join(pastaSaida, `${rota}.png`), fullPage: true });
      relatorio.push({ rota, texto, status });
      console.log(`${rota.padEnd(16)} ${String(texto).padStart(6)} chars   ${status}`);
    } catch (err) {
      console.log(`${rota.padEnd(16)} ERRO: ${err.message}`);
      relatorio.push({ rota, texto: 0, status: 'ERRO' });
    }
  }

  const ok = relatorio.filter(r => r.status === 'ok').length;
  console.log(`\n${ok} de ${ROTAS.length} telas com conteúdo`);
  relatorio.filter(r => r.status !== 'ok')
    .forEach(r => console.log(`  FALHOU: ${r.rota} — ${r.status}`));

  await context.close();
  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
