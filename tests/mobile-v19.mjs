import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { chromium as browserType } from 'playwright';
const repo=process.cwd();
const server=await createServer({root:repo,configFile:false,plugins:[react(),tailwind()],resolve:{alias:[{find:'virtual:pwa-register',replacement:path.join(repo,'tests/fixtures/pwaStub.js')},{find:/(?:.*\/lib\/supabase|\.\/supabase)(?:\.js)?$/,replacement:repo+'/tests/fixtures/mobileV19Supabase.js'}]},server:{port:5179,host:'127.0.0.1'}});await server.listen();
const browser=await browserType.launch({headless:true,executablePath:process.env.MOBILE_BROWSER_EXECUTABLE || undefined,args:process.env.MOBILE_BROWSER_EXECUTABLE ? ['--no-sandbox','--no-zygote','--single-process','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] : []});
const page=await browser.newPage({viewport:{width:440,height:956},isMobile:true,hasTouch:true,deviceScaleFactor:1,locale:'it-IT',timezoneId:'Europe/Rome'});
const errors=[];page.on('pageerror',err=>errors.push(err.message));
fs.mkdirSync(process.env.MOBILE_SCREENSHOT_DIR || repo+'/docs/mobile-v19',{recursive:true});
async function shot(name){if (!process.argv.includes('--screenshots')) return;await page.screenshot({path:path.join(process.env.MOBILE_SCREENSHOT_DIR || repo+'/docs/mobile-v19',name+'.png')});}
async function audit(name){
 const result = await page.evaluate(() => {
   const width=innerWidth;
   const visible=element => element.getClientRects().length && getComputedStyle(element).visibility!=='hidden';
   const controls=[...document.querySelectorAll('main button,main input,main select,main textarea')].filter(visible);
   return {
     page:document.querySelector('main')?.dataset.page,
     duplicateTitles:[...document.querySelectorAll('.pm-cassa-page-heading,.pm-page-section-title,.pm-page-refresh,.pm-conteggi-actions [data-page-refresh]')].filter(visible).length,
     tabBottom:document.querySelector('.pm-mobile-tabbar')?.getBoundingClientRect().bottom,
     summaryOverlap:(() => { const heading=document.querySelector('.pm-conteggi-summary-heading'); if(!heading) return false; const title=heading.querySelector('h2').getBoundingClientRect(); const actions=heading.querySelector('div').getBoundingClientRect(); return actions.top < title.bottom; })(),
     overflow:controls.filter(el => { const r=el.getBoundingClientRect();return r.right>width+2 || r.left < -2; }).map(el=>el.getAttribute('aria-label') || el.textContent.slice(0,50)),
     smallFonts:[...document.querySelectorAll('main input:not([type=checkbox]),main select,main textarea')].filter(visible).filter(el=>parseFloat(getComputedStyle(el).fontSize)<16).map(el=>el.className),
   };
 });
 assert.equal(result.overflow.length,0,`${name}: controls outside viewport: ${result.overflow}`);
 if ((await page.viewportSize()).width<768) {
  assert.equal(result.smallFonts.length,0,`${name}: input text must not zoom on iOS`);
  assert.ok(Math.abs(result.tabBottom-(await page.viewportSize()).height)<2,`${name}: tab bar must meet viewport bottom`);
  assert.equal(result.duplicateTitles,0,`${name}: old title and refresh must be hidden`);
  assert.equal(result.summaryOverlap,false,`${name}: summary title overlaps actions`);
  if(['cassa','analisi','conteggi'].includes(result.page)) {
   assert.equal(await page.locator('.pm-mobile-header').getByRole('button',{name:`Aggiorna ${result.page}`,exact:true}).count(),1);
  }
 }
 console.log(`PASS layout: ${name}`);
}

async function swipe(x1,y1,x2,y2) {
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x1,y:y1}]});
 for(let step=1;step<=6;step++) {await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x1+(x2-x1)*step/6,y:y1+(y2-y1)*step/6}]});await page.waitForTimeout(20);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();await page.waitForTimeout(400);
}

try{
 await page.goto('http://127.0.0.1:5179');await page.waitForSelector('.pm-simple-splash');await shot('splash');await page.waitForSelector('.pm-mobile-tabbar');await page.waitForTimeout(250);await shot('analisi');await audit('analisi');
 assert.deepEqual(await page.getByRole('navigation',{name:'Navigazione principale'}).getByRole('button').allTextContents(),['CASSA','ANALISI','CONTEGGI']);
 await page.getByRole('button',{name:'Apri menu',exact:true}).click();await page.waitForTimeout(400);
 await swipe(180,750,180,350);
 assert.ok(await page.locator('.pm-mobile-menu-list').evaluate(el=>el.scrollTop)>0,'Menu must scroll with vertical touch');
 await swipe(250,400,30,400);
 assert.equal(await page.locator('#admin-mobile-menu').evaluate(el=>el.open),false,'Left swipe closes drawer');
 await swipe(2,400,280,400);
 assert.equal(await page.locator('#admin-mobile-menu').evaluate(el=>el.open),true,'Edge swipe opens drawer');
 await page.getByRole('button',{name:'Chiudi menu',exact:true}).click();

 for(const width of [430,375]) { await page.setViewportSize({width,height:932});await audit(`analisi-${width}`); }
 await page.setViewportSize({width:440,height:956});
 await page.locator('.pm-admin-shell').evaluate(el=>el.style.setProperty('--pm-safe-bottom','34px'));
 await audit('analisi-safe-area-34');
 const frame=await page.evaluate(()=>({main:document.querySelector('main').getBoundingClientRect().bottom,bar:document.querySelector('.pm-mobile-tabbar').getBoundingClientRect().top}));
 assert.ok(Math.abs(frame.main-frame.bar)<2,'Page must end exactly where the tab bar begins');
 await page.locator('.pm-admin-shell').evaluate(el=>el.style.removeProperty('--pm-safe-bottom'));
 await page.getByRole('button',{name:'Aggiorna analisi',exact:true}).click();await page.waitForTimeout(200);
 const movements=page.getByRole('button',{name:'Movimenti',exact:true});if(await movements.count()){await movements.first().click();await shot('analisi-movimenti');await audit('analisi-movimenti');}
 await page.getByRole('navigation',{name:'Navigazione principale'}).getByRole('button',{name:'CASSA',exact:true}).click();await page.waitForTimeout(250);await shot('cassa');await audit('cassa');for(const width of [430,375]){await page.setViewportSize({width,height:932});await audit(`cassa-${width}`);}await page.setViewportSize({width:440,height:956});
 const beforeSelection=await page.locator('.pm-cassa-select input').isChecked();
 await page.locator('.pm-cassa-select').click();assert.notEqual(await page.locator('.pm-cassa-select input').isChecked(),beforeSelection);
 assert.equal(await page.getByRole('dialog').count(),0,'Selecting a movement must not open the editor');
 await page.locator('.pm-cassa-select').click();
 await page.getByRole('button',{name:/Apri movimento/}).first().click();await shot('cassa-modifica');
 assert.equal(await page.locator('.pm-cassa-select input').isChecked(),false,'Opening the editor must not select for deletion');
 await audit('cassa-modifica');await page.getByRole('button',{name:'Chiudi',exact:true}).click();
 await page.getByRole('button',{name:'Filtri',exact:true}).click();await shot('cassa-filtri');await page.getByRole('button',{name:'Mostra movimenti'}).click();
 await page.getByRole('navigation',{name:'Navigazione principale'}).getByRole('button',{name:'CONTEGGI',exact:true}).click();await page.waitForTimeout(350);await shot('conteggi');await audit('conteggi');for(const width of [430,375]){await page.setViewportSize({width,height:932});await audit(`conteggi-${width}`);}await page.setViewportSize({width:440,height:956});
 const missing=page.locator('.pm-missing-row');assert.ok(await missing.count(),'Fixture must exercise missing venues');await missing.first().scrollIntoViewIfNeeded();await shot('conteggi-locali');await audit('conteggi-locali');
 await missing.first().getByRole('button').click();assert.ok(await page.getByRole('button',{name:'OK',exact:true}).count());await page.getByRole('button',{name:'OK',exact:true}).click();
 for(const [label,id] of [['LOCALI','locali'],['CALENDARIO','calendario'],['DEBITI E BONUS','debiti'],['SIMULAZIONI','simulazioni'],['AGENTI','agenti'],['GIRI','giri'],['AUTOMEZZI','automezzi'],['CESTINO','cestino'],['CASSA UFFICIO','contabilita-cassa']]){
  await page.getByRole('button',{name:'Apri menu',exact:true}).click();if(id==='locali'){await page.waitForTimeout(400);assert.equal(await page.locator('.pm-mobile-menu-list small').count(),0);await shot('menu')};await page.getByRole('navigation',{name:'Tutte le sezioni'}).getByRole('button').filter({has:page.locator('strong',{hasText:label})}).first().click();await page.waitForTimeout(300);await shot(id);await audit(id);for (const width of [430,375]) {await page.setViewportSize({width,height:932});await audit(`${id}-${width}`);}await page.setViewportSize({width:440,height:956});
  if(id==='calendario') {
   const day=page.locator('.pm-calendar-agenda button:not(:disabled)').first();const prior=await day.getAttribute('aria-pressed');await day.click();assert.notEqual(await day.getAttribute('aria-pressed'),prior);
   await page.getByRole('button',{name:'Mese',exact:true}).click();await audit('calendario-mese');await page.getByRole('button',{name:'Agenda',exact:true}).click();
 }
 if(id==='locali'){await page.locator('.pm-locali-scroll button').first().click();await page.waitForTimeout(200);await shot('locale-dettaglio');await audit('locale-dettaglio');}
 }
 assert.deepEqual(errors,[],'No runtime errors in mobile pages');
 await page.setViewportSize({width:1440,height:900});await page.locator('.pm-mobile-tabbar').waitFor({state:'detached'});assert.equal(await page.locator('.pm-mobile-tabbar').count(),0,'Desktop must keep its sidebar');assert.equal(await page.locator('.pm-admin-shell > aside').count(),1);await shot('desktop');
 await page.setViewportSize({width:440,height:956});
 await page.getByRole('button',{name:'Apri menu',exact:true}).click();await page.getByRole('button',{name:'Esci dall’account'}).click();await page.waitForSelector('.pm-login-screen');await shot('login');
 await page.setViewportSize({width:1440,height:900});await shot('login-desktop');
 await page.setViewportSize({width:430,height:932});
 await page.locator('#pm-login-password').fill('invalid');await page.getByRole('button',{name:'Accedi',exact:true}).click();await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').textContent(),/non corretta/);
 assert.equal(await page.locator('#pm-login-password').getAttribute('type'),'text');assert.equal(await page.locator('#pm-login-password').getAttribute('placeholder'),null);
 await page.locator('#pm-login-password').fill('1234');await page.getByRole('button',{name:'Accedi',exact:true}).click();
 const calls=await page.evaluate(async()=>{const {mobileFixture}=await import('/tests/fixtures/mobileV19Supabase.js');return mobileFixture.calls.filter(call=>call.auth==='signIn');});assert.equal(calls.at(-1).credentials.email,'admin@playmoney.com');assert.equal(calls.at(-1).credentials.password,'pm1234','Legacy PIN must use Admin compatibility');
 await page.goto('http://127.0.0.1:5179/?auth=denied');await page.waitForSelector('.pm-login-screen');assert.match(await page.getByRole('alert').textContent(),/non è autorizzato/);
 assert.deepEqual(errors,[]);
 console.log('PASS mobile v19: navigation, selection isolation, editors, filters, calendar, sections, desktop and login');
} finally {await browser.close();await server.close();}
