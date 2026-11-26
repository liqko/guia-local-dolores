import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const source=readFileSync(new URL('../../worker/worker206.txt',import.meta.url),'utf8');
const start=source.indexOf('GldPublicCache119.prototype.requestCommercePreparation209=');
const end=source.indexOf('GldPublicCache119.prototype.runCommercePreparation209=',start);
assert(start>=0&&end>start);
const actor=class {};
Function('GldPublicCache119',source.slice(start,end))(actor);

test('la lectura comercial conserva la alarma de recuperación y rearma si se perdió',async()=>{
 const current=new actor();
 let alarm=Date.now()+60_000;
 const calls={get:0,put:0,alarm:0};
 current.state={storage:{
  async get(){calls.get++;return {aid:'A',attempts:2};},
  async put(){calls.put++;},
  async getAlarm(){return alarm;},
  async setAlarm(next){calls.alarm++;alarm=next;}
 }};
 await current.requestCommercePreparation209('A');
 await current.requestCommercePreparation209('A');
 assert.deepEqual(calls,{get:1,put:0,alarm:0});
 alarm=null;
 await current.requestCommercePreparation209('A');
 assert.equal(calls.alarm,1);
 assert(alarm>Date.now());
});

test('una ficha sin preparación conserva la programación inicial',async()=>{
 const current=new actor();
 let saved,alarm;
 current.state={storage:{async get(){return null;},async put(_key,value){saved=value;},
  async getAlarm(){return null;},async setAlarm(value){alarm=value;}}};
 await current.requestCommercePreparation209('A');
 assert.deepEqual(saved,{aid:'A',attempts:0});
 assert(alarm>Date.now());
});
