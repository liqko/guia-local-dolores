'use strict';
const fs=require('node:fs'),path=require('node:path');
function detect(files){
const w=files['worker/worker206.txt'],g=files['plataforma/administracion.html'],hits=[];
const line=(s,p)=>p<0?null:s.slice(0,p).split('\n').length;
const add=(id,kind,file,positions,evidence)=>hits.push({id,kind,file,lines:positions.filter(x=>x!==null),evidence,physicalCostVerified:false});
const start=w.indexOf('async function preparePublicationV77('),end=w.indexOf('// Revisiones delegadas.',start);
const block=w.slice(start,end);const rx=/verifySubscriberSession\(ctx\.env,ctx\.request\)/g;
const auth=[...block.matchAll(rx)].map(m=>line(w,start+m.index));if(auth.length>1)add('P3-001','same-request-session-verification','worker/worker206.txt',auth,'Two calls within preparePublicationV77');
for(const [id,text]of [['P3-002','return businessDispatch143;'],['P3-003','return guideDispatch;']]){let p=w.indexOf(text);if(p>=0)add(id,'observation-bypass','worker/worker206.txt',[line(w,p)],'Delegated response bypasses traced()');}
const rel=w.indexOf('async function cachedAdvertiserRelations104('),relEnd=w.indexOf('async function relationOwners(',rel),sub=w.slice(rel,relEnd);
if(sub.includes("kv.list({prefix:key+':delta:'"))add('P3-004','kv-list-on-hot-path','worker/worker206.txt',[line(w,w.indexOf("kv.list({prefix:key+':delta:'",rel))],'KV LIST is invoked whenever relations are consulted, even on packet hit');
const pan=w.indexOf('async function panelQuery('),panEnd=w.indexOf('async function panelGet(',pan),panel=w.slice(pan,panEnd);
if(panel.includes('await optionalSave(key,{data,revision:'))add('P3-005','cache-write-on-read-miss','worker/worker206.txt',[line(w,w.indexOf('await optionalSave(key,{data,revision:',pan))],'Cache miss triggers PUT on read; may be required, not proven redundant');
const burst=g.indexOf("catalogResults=await Promise.allSettled(catalogTypes.map(");
if(burst>=0)add('P3-006','browser-request-fanout','plataforma/administracion.html',[line(g,burst)],'Opening advertiser issues nine catalog requests; deduplication/reuse requires runtime check');
const layers=w.indexOf('db=withPanelCacheV48(withAuthCacheV58(');if(layers>=0)add('P3-007','stacked-cache-layers','worker/worker206.txt',[line(w,layers)],'Nested wrappers may multiply indirect operations; not evidence of duplication');
return {schema:1,findings:hits,counts:{confirmedSource:hits.filter(x=>['P3-001','P3-002','P3-003','P3-004'].includes(x.id)).length,requiresRuntime:hits.length},note:'Static detection. No Cloudflare/Firestore billing claims.'};
}
if(require.main===module){const root=process.argv[2]||'.',paths=['worker/worker206.txt','plataforma/administracion.html'];const files=Object.fromEntries(paths.map(p=>[p,fs.readFileSync(path.join(root,p),'utf8')]));const result=detect(files);console.log(JSON.stringify(result,null,2));if(result.findings.length<7)process.exitCode=1;}
module.exports={detect};