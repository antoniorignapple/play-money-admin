import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const root=process.cwd();
const server=await createServer({root,configFile:false,define:{__APP_BUILD_ID__:JSON.stringify('qa-build')},plugins:[{
 name:'update-ui-fixture',enforce:'pre',
 configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url!=='/qa-update'){next();return;}res.setHeader('Content-Type','text/html');void server.transformIndexHtml('/qa-update','<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/qa-update.jsx"></script></body></html>').then(html=>res.end(html));});},
 resolveId(id){if(id==='virtual:pwa-register')return '\0pwa-qa';if(id==='/qa-update.jsx')return id;},
 load(id){if(id==='\0pwa-qa')return 'export function registerSW(options){window.__updateOptions=options;queueMicrotask(()=>options.onRegisteredSW("sw.js",window.__registration));return ()=>{};}';if(id==='/qa-update.jsx')return 'import React from "react";import {createRoot} from "react-dom/client";import UpdateNotice from "/src/components/UpdateNotice.jsx";import "/src/index.css";createRoot(document.getElementById("root")).render(<UpdateNotice/>);';}
},react(),tailwind()],server:{host:'127.0.0.1',port:5182}});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.MOBILE_BROWSER_EXECUTABLE,args:process.env.MOBILE_BROWSER_EXECUTABLE?['--no-sandbox','--no-zygote','--single-process','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
try{
 const page=await browser.newPage({viewport:{width:440,height:956},isMobile:true,hasTouch:true});
 page.on('pageerror',e=>console.error(e));await page.route('**/release.json*',route=>route.fulfill({json:{VERSION:'19.6',TITLE:'Novità della versione',ITEMS:['PDF Contabilità Conteggi più compatto','Aggiornamenti con note e conferma']}}));
 await page.addInitScript(()=>{const worker=new EventTarget();Object.defineProperty(navigator,'serviceWorker',{value:worker});window.__registration={update:async()=>{},waiting:{postMessage(){setTimeout(()=>worker.dispatchEvent(new Event('controllerchange')),20);}}};});
 await page.goto('http://127.0.0.1:5182/qa-update');await page.waitForFunction(()=>window.__updateOptions);
 await page.evaluate(()=>window.__updateOptions.onNeedRefresh());
 await page.getByText('PDF Contabilità Conteggi più compatto',{exact:true}).waitFor();
 for(const width of [375,430,440]){await page.setViewportSize({width,height:956});const r=await page.getByRole('dialog').boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width);}
 await page.getByRole('button',{name:'Più tardi',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:'Aggiornamento disponibile',exact:true}).click();
 await page.evaluate(()=>localStorage.setItem('pm_movimenti_v1_qa',JSON.stringify([{status:'pending'}])));
 await page.getByRole('button',{name:'Aggiorna ora',exact:true}).click();await page.getByText('Prima sincronizza i movimenti Cassa sospesi.',{exact:true}).waitFor();
 await page.evaluate(()=>localStorage.removeItem('pm_movimenti_v1_qa'));
 await page.getByRole('button',{name:'Aggiorna ora',exact:true}).click();
 await page.getByRole('heading',{name:'Play Money Admin aggiornata',exact:true}).waitFor();
 await page.getByRole('button',{name:'Continua',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);
 console.log('PASS update UI: 375/430/440, notes, defer, pending guard, worker reload and installed confirmation');
}finally{await browser.close();await server.close();}
