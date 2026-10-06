import {createServer} from 'vite';import react from '@vitejs/plugin-react';import tailwind from '@tailwindcss/vite';import {chromium} from 'playwright';import assert from 'node:assert/strict';
const root=process.cwd();const server=await createServer({root,configFile:false,plugins:[react(),tailwind()],resolve:{alias:[{find:'virtual:pwa-register',replacement:root+'/tests/fixtures/pwaStub.js'},{find:/(?:.*\/lib\/supabase|\.\/supabase)(?:\.js)?$/,replacement:root+'/tests/fixtures/debtMovementsSupabase.js'}]},server:{host:'127.0.0.1',port:5183}});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.MOBILE_BROWSER_EXECUTABLE,args:process.env.MOBILE_BROWSER_EXECUTABLE?['--no-sandbox','--no-zygote','--single-process','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
try{
 const page=await browser.newPage({viewport:{width:440,height:956},isMobile:true,hasTouch:true});
 await page.goto('http://127.0.0.1:5183');await page.waitForSelector('.pm-mobile-tabbar');await page.getByRole('button',{name:'Apri menu',exact:true}).click();await page.getByRole('button',{name:'DEBITI E BONUS',exact:true}).click();
 await page.getByRole('button',{name:'Vedi movimenti',exact:true}).click();
 const table=page.getByRole('table',{name:'Erogazioni e rimborsi'});await table.waitFor();
 assert.equal(await table.getByRole('button').count(),6);
 for(const width of [375,430,440]){await page.setViewportSize({width,height:956});const r=await table.boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width+1);}
 await table.getByRole('button',{name:'Modifica Nuova erogazione del 10/09/2026',exact:true}).click();
 await page.getByRole('spinbutton').fill('700');await page.getByRole('button',{name:'Salva movimento',exact:true}).click();
 await table.getByText('700 €',{exact:true}).waitFor();
 await table.getByRole('button',{name:'Elimina Nuova erogazione del 10/09/2026',exact:true}).click();
 await page.getByRole('button',{name:'Elimina movimento',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('table[aria-label="Erogazioni e rimborsi"]')&&!document.querySelector('table[aria-label="Erogazioni e rimborsi"]').textContent.includes('Nuova erogazione'));
 assert.ok(await table.getByText('Rimborso manuale',{exact:true}).count());
 const calls=await page.evaluate(async()=>{const m=await import('/tests/fixtures/debtMovementsSupabase.js');return m.ledgerFixture.calls;});
 assert.equal(calls.length,2);assert.equal(calls[0].p_amount,700);assert.equal(calls[1].p_delete,true);assert.equal(calls[0].p_kind,'disbursement');
 console.log('PASS ledger UI: per-row actions, 375/430/440 layout, edit, confirmed delete, history refresh and RPC payloads');
}finally{await browser.close();await server.close();}
