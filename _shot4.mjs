import { createRequire } from 'module';
const require = createRequire('/home/claude/.npm-global/lib/node_modules/x.js');
const { chromium } = require('playwright');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 2 });
await p.goto('file:///tmp/preview3.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
async function shot(name){ await p.screenshot({path:'/tmp/p3_'+name+'.png'}); }
await p.click('.nav[data-s=crm]'); await p.waitForTimeout(300);
await p.click('a[data-t=crm-leads]'); await p.waitForTimeout(300); await shot('crm_leads');
await p.click('a[data-t=crm-vproc]'); await p.waitForTimeout(300); await shot('crm_vproc');
await p.click('a[data-t=crm-analitico]'); await p.waitForTimeout(300); await shot('crm_analitico');
await p.click('a[data-t=crm-agenda]'); await p.waitForTimeout(300); await shot('crm_agenda');
await p.click('.nav[data-s=fin]'); await p.waitForTimeout(300);
await p.click('a[data-t=fin-vendas]'); await p.waitForTimeout(300); await shot('fin_vendas');
await p.click('a[data-t=fin-fluxo]'); await p.waitForTimeout(300); await shot('fin_fluxo');
await p.click('a[data-t=fin-metas]'); await p.waitForTimeout(300); await shot('fin_metas');
console.log('ok');
await b.close();
