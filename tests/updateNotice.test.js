import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { transform } from 'esbuild';
import { updateBlockReason, freezeWritesForUpdate } from '../src/lib/updateSafety.js';
import { RELEASE, APP_VERSION } from '../src/config/release.js';

// Exercise the real component with a local worker: no network or production writes.
test('Admin update: notes, defer, pending guard, worker activation and installed confirmation', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://admin.test' });
  const previous = new Map();
  for (const [key, value] of Object.entries({ window:dom.window, document:dom.window.document, navigator:dom.window.navigator, localStorage:dom.window.localStorage, sessionStorage:dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT:true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis,key)); Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  }
  const serviceWorker = new dom.window.EventTarget();
  Object.defineProperty(navigator,'serviceWorker',{value:serviceWorker});
  Object.defineProperty(navigator,'onLine',{value:true,configurable:true});
  let options, posted=0, reloaded=0;
  const registration={update:async()=>{},waiting:{postMessage(message){assert.equal(message.type,'SKIP_WAITING');posted++;serviceWorker.dispatchEvent(new dom.window.Event('controllerchange'));}}};
  const context={React,useState:React.useState,useRef:React.useRef,useEffect:React.useEffect,useCallback:React.useCallback,
    window:new Proxy(dom.window,{get(target,key){if(key==='location')return {reload(){reloaded++;}};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}}),
    document,navigator,localStorage,sessionStorage,console,URL,Date,RELEASE,APP_VERSION,__APP_BUILD_ID__:'build-new',updateBlockReason,freezeWritesForUpdate,
    fetch:async()=>({ok:true,json:async()=>({...RELEASE,ITEMS:['NOTA PUBBLICATA DI PROVA']})}),
    registerSW(value){options=value;return ()=>{};}};
  const source=fs.readFileSync(new URL('../src/components/UpdateNotice.jsx',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default function UpdateNotice','function UpdateNotice');
  // Lightweight icons keep this test focused on update behavior.
  for(const name of ['CheckCircle2','DownloadCloud','RefreshCw','X'])context[name]=()=>null;
  vm.createContext(context);vm.runInContext((await transform(source,{loader:'jsx',jsx:'transform'})).code+'\nglobalThis.Component=UpdateNotice;',context);
  let root=createRoot(document.getElementById('root'));
  const render=async()=>{await act(async()=>root.render(React.createElement(context.Component)));};
  const click=async label=>{const button=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===label);assert.ok(button,label);await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
  try {
    await render();assert.equal(document.querySelector('[role="dialog"]'),null);
    await act(async()=>{options.onRegisteredSW('sw.js',registration);options.onNeedRefresh();});
    assert.ok(document.body.textContent.includes('NOTA PUBBLICATA DI PROVA'));
    await click('Più tardi');assert.equal(document.querySelector('[role="dialog"]'),null);
    await click('Aggiornamento disponibile');
    localStorage.setItem('pm_movimenti_v1_user',JSON.stringify([{id:'a',status:'pending'}]));
    await click('Aggiorna ora');assert.equal(posted,0);assert.ok(document.body.textContent.includes('Prima sincronizza'));
    localStorage.removeItem('pm_movimenti_v1_user');
    await click('Aggiorna ora');assert.equal(posted,1);assert.equal(reloaded,1);
    assert.equal(sessionStorage.getItem('pm_admin_pwa_update_completed_v1'),'1');
    // Simulate the new document after activation.
    await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await render();
    assert.ok(document.body.textContent.includes('Play Money Admin aggiornata'));
    assert.ok(document.body.textContent.includes(RELEASE.ITEMS[0]));
    await click('Continua');assert.equal(document.querySelector('[role="dialog"]'),null);
  } finally {
    await act(async()=>root.unmount());dom.window.close();
    for(const [key,descriptor]of previous)descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key];
  }
});
