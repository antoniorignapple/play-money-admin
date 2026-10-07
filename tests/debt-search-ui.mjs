import {createServer} from 'vite';import react from '@vitejs/plugin-react';import tailwind from '@tailwindcss/vite';import {chromium} from 'playwright';import assert from 'node:assert/strict';
const root=process.cwd();const server=await createServer({root,configFile:false,plugins:[react(),tailwind()],resolve:{alias:[{find:'virtual:pwa-register',replacement:root+'/tests/fixtures/pwaStub.js'},{find:/(?:.*\/lib\/supabase|\.\/supabase)(?:\.js)?$/,replacement:root+'/tests/fixtures/debtSearchSupabase.js'}]},server:{host:'127.0.0.1',port:5184}});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.MOBILE_BROWSER_EXECUTABLE,args:process.env.MOBILE_BROWSER_EXECUTABLE?['--no-sandbox','--no-zygote','--single-process','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
try{
 const page=await browser.newPage({viewport:{width:440,height:956},isMobile:true,hasTouch:true});
 await page.goto('http://127.0.0.1:5184');await page.waitForSelector('.pm-mobile-tabbar');await page.getByRole('button',{name:'Apri menu',exact:true}).click();await page.getByRole('button',{name:'DEBITI E BONUS',exact:true}).click();
 const search=page.getByRole('searchbox',{name:'CERCA DEBITI',exact:true});await search.waitFor();
 for(const width of [375,430,440,1280]){await page.setViewportSize({width,height:956});const r=await search.boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width+1);assert.ok(r.height>=44);}
 // Typing C would normally navigate to Cassa: local search must take priority.
 await page.locator('.finance-eyebrow').first().click();await page.keyboard.type('cont');
 assert.equal(await search.inputValue(),'cont');assert.equal(await page.locator('.debt-card').count(),0);
 await page.getByText('Nessun risultato trovato',{exact:true}).waitFor();
 await search.fill('bonifico');assert.equal(await page.locator('.debt-card').count(),1);
 await search.fill('K1 dimostrativo');assert.equal(await page.locator('.debt-card').count(),1);
 await search.fill('1.400');assert.equal(await page.locator('.debt-card').count(),1);
 await page.getByRole('button',{name:'Cancella ricerca',exact:true}).click();assert.equal(await search.inputValue(),'');
 await search.press('Escape');await search.evaluate(el=>el.blur());await page.keyboard.press('/');assert.equal(await search.evaluate(el=>el===document.activeElement),true);assert.equal(await search.inputValue(),'');
 await page.getByRole('tab',{name:/Bonus/}).click();await page.getByRole('searchbox',{name:'CERCA BONUS'}).fill('jose');await page.getByText('250 €',{exact:true}).waitFor();
 await page.getByRole('tab',{name:/Note/}).click();const noteSearch=page.getByRole('searchbox',{name:'CERCA NOTE'});await noteSearch.fill('fondo cassa');await page.getByText('Fondo cassa aggiornato',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Nuovo promemoria',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();await dialog.getByRole('heading').click();await page.keyboard.type('abc');assert.equal(await page.locator('#finance-search-input').inputValue(),'fondo cassa');
 await page.getByRole('button',{name:'Chiudi popup',exact:true}).click();
 await page.setViewportSize({width:440,height:956});await page.getByRole('button',{name:'Apri menu',exact:true}).click();await page.getByRole('button',{name:'CASSA',exact:true}).last().click();await page.keyboard.press('a');assert.equal(await page.getByRole('searchbox').count(),0);
 console.log('PASS search UI: 375/430/440/1280, type-to-search precedence, venue/amount/bonus/note filters, reset, slash focus, modal and navigation isolation');
}finally{await browser.close();await server.close();}
