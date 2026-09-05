import test from 'node:test';
import assert from 'node:assert/strict';
import {trackWrite,activeWriteCount,freezeWritesForUpdate,updateBlockReason} from '../src/lib/updateSafety.js';
test('richiesta pendente blocca update e il contatore viene rilasciato su errore',async()=>{
  let release;
  const request=trackWrite(()=>new Promise((_,reject)=>{release=reject}),'/rpc',{method:'POST'});
  assert.equal(activeWriteCount(),1);assert.ok(updateBlockReason());
  assert.throws(freezeWritesForUpdate,/corso/);
  release(Error('rete'));await assert.rejects(request,/rete/);
  assert.equal(activeWriteCount(),0);
});
test('freeze impedisce nuove scritture, non letture, e si può rilasciare',async()=>{
  const release=freezeWritesForUpdate();
  await assert.rejects(trackWrite(()=>true,'/save',{method:'POST'}),/Aggiornamento/);
  assert.equal(await trackWrite(()=>42,'/read'),42);
  release();assert.equal(await trackWrite(()=>true,'/save',{method:'POST'}),true);
});
test('controlla outbox, Cassa legacy e JSON corrotto',()=>{
  assert.ok(updateBlockReason({outbox:[{status:'error'}]}));
  const storage=value=>({length:1,key:()=> 'pm_movimenti_v1_A',getItem:()=>value});
  assert.ok(updateBlockReason({storage:storage('[{"status":"pending"}]')}));
  assert.ok(updateBlockReason({storage:storage('{bad')}));
  assert.equal(updateBlockReason({storage:storage('[{"status":"saved"}]')}),'');
});
