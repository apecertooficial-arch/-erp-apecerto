import { createRequire } from 'module';
const require = createRequire('/home/claude/.npm-global/lib/node_modules/x.js');
const { chromium } = require('playwright');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e=>console.log('goto',e.message));
// limpa qualquer sessão e recarrega para cair na tela de login
await p.evaluate(() => { try{localStorage.clear();sessionStorage.clear();}catch(e){} });
await p.reload({ waitUntil: 'domcontentloaded' }).catch(()=>{});
await p.waitForTimeout(7000);
await p.screenshot({ path: '/tmp/login_page.png' });
const hasLogin = await p.locator('.auth-card, .login-page').count();
console.log('login elements:', hasLogin);
await b.close();
