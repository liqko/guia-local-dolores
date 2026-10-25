import {DatabaseSync} from 'node:sqlite';
import {generateKeyPairSync,createHmac} from 'node:crypto';
export const actorName='territory-actions-v138';
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{format:'pem',type:'pkcs8'},publicKeyEncoding:{format:'pem',type:'spki'}});
const secret='local-tests-not-a-production-secret';
export const city=(id,name=id)=>({ciudad_id:id,ciudad_visible:name,pais_id:'AR',provincia_id:'P',activa:true});
const field=value=>value===null?{nullValue:null}:Array.isArray(value)?{arrayValue:{values:value.map(field)}}:typeof value==='object'?{mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,field(v)]))}}:typeof value==='boolean'?{booleanValue:value}:typeof value==='number'?{integerValue:String(value)}:{stringValue:value};
const fields=row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,field(v)]));
export function session(role='SUPERADMIN_PRINCIPAL',extra={}){const body=Buffer.from(JSON.stringify({sid:'fixture',rol:role,ciudades:['A'],permisos:{},persistent:true,sv:0,...extra})).toString('base64url');return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');}
export function fixture(Actor,{cities=[],empty=false}={}){
 const countries=[{id:'AR',pais_id:'AR',nombre:'Argentina',pais_visible:'Argentina',activo:true}],provinces=[{id:'P',provincia_id:'P',pais_id:'AR',nombre:'Provincia',provincia_visible:'Provincia',activo:true}];
 const admin={version:1,updated_at:'initial',paises:countries,provincias:provinces,ciudades:cities.map(c=>({id:c.ciudad_id,...c}))};
 const pub={...structuredClone(admin),ciudades:cities.filter(c=>c.activa!==false).map(c=>({ciudad_id:c.ciudad_id,ciudad_visible:c.ciudad_visible,provincia_id:'P',provincia_visible:'Provincia',pais_id:'AR',pais_visible:'Argentina',pais_codigo:'',activa:true}))};
 const kv=new Map(empty?[]:[['territorio:admin:v1',JSON.stringify(admin)],['territorio:public:v1',JSON.stringify(pub)]]),docs=new Map(),actors=new Map(),states=new Map();
 for(const [collection,rows]of Object.entries({paises:countries,provincias:provinces,ciudades:admin.ciudades}))for(const row of rows)docs.set(collection+'/'+row.id,{name:'projects/local/databases/(default)/documents/'+collection+'/'+row.id,fields:fields(row),updateTime:'2026-10-25T00:00:00.000Z'});
 const all=[],fail={publicPut:0,sourceAfterWrite:0,sqlAfterSource:0,cancelAlarm:0,transportAfter:0,transportBefore:0,sqlComplete:0},counts={};let revision=1;
 function count(service,operation,detail){all.push({service,operation,detail});const key=service+'.'+operation;counts[key]=(counts[key]||0)+1;}
 const env={SERVER_SECRET:secret,FIREBASE_PROJECT_ID:'local',FIREBASE_CLIENT_EMAIL:'fixture@local.invalid',FIREBASE_PRIVATE_KEY:privateKey,
  GLD_CACHE_KV:{async get(key){count('kv','get',key);return kv.get(key)||null;},async put(key,value){count('kv','put',key);if(key==='territorio:public:v1'&&fail.publicPut){fail.publicPut--;throw Error('Injected public publication failure');}kv.set(key,value);},async delete(key){count('kv','delete',key);kv.delete(key);},async list(){count('kv','list');return {keys:[],list_complete:true};}}
 };
 const namespace={idFromName:name=>({name}),get(id){const name=id.name||id;if(!actors.has(name))create(name);return {async fetch(request){count('do','calls',name);if(fail.transportBefore){fail.transportBefore--;throw Error('Injected transport failure');}const result=await actors.get(name).fetch(request);if(fail.transportAfter){fail.transportAfter--;throw Error('Injected lost DO response');}return result;}};}};
 env.GLD_PUBLIC_CACHE=namespace;
 function create(name){
  let state=states.get(name);
  if(!state){
   const database=new DatabaseSync(':memory:'),values=new Map();let alarm=null;
   // Runtime ids can lose their human name on cold alarm delivery.
   state={id:{toString:()=>name},database,storage:{async get(key){count('do-kv','get',key);return structuredClone(values.get(key));},async put(key,value){count('do-kv','put',key);values.set(key,structuredClone(value));},sql:{exec(statement,...args){
    if(fail.sqlAfterSource&&/^INSERT INTO shared_action138/.test(statement)&&String(args[0]).includes('"phase":"publish"')){fail.sqlAfterSource--;throw Error('Injected checkpoint failure');}
    if(fail.sqlComplete&&/^INSERT INTO shared_action138/.test(statement)&&String(args[0]).includes('"pending":null')){fail.sqlComplete--;throw Error('Injected completion failure');}
    const prepared=database.prepare(statement);let rows=[],written=0;
    if(/^SELECT/.test(statement))rows=prepared.all(...args);else{const result=prepared.run(...args);written=/^(INSERT|UPDATE|DELETE|REPLACE)/.test(statement)?Number(result.changes):0;}
    if(rows.length)count('sql','read',rows.length);
    if(written)count('sql','write',written);
    return Object.assign(rows,{rowsRead:rows.length,rowsWritten:written});
   }},async setAlarm(value){count('alarm','set');alarm=value;},async getAlarm(){return alarm;},async deleteAlarm(){count('alarm','cancel');if(fail.cancelAlarm){fail.cancelAlarm--;throw Error('Injected cancellation failure');}alarm=null;},transactionSync(fn){database.exec('BEGIN');try{const out=fn();database.exec('COMMIT');return out;}catch(e){database.exec('ROLLBACK');throw e;}}}};
   states.set(name,state);
  }
  actors.set(name,new Actor(state,env));
 }
 async function network(input,options={}){
  const url=new URL(typeof input==='string'?input:input.url);
  if(url.hostname==='oauth2.googleapis.com'){count('oauth','token');return Response.json({access_token:'local-only',expires_in:3600});}
  if(url.hostname!=='firestore.googleapis.com')throw Error('External network blocked: '+url.hostname);
  const relative=decodeURIComponent(url.pathname.split('/documents/')[1]||''),method=options.method||'GET';
  count('firestore',method,relative);
  if(method==='PATCH'){
   const before=docs.get(relative),expected=url.searchParams.get('currentDocument.updateTime'),exists=url.searchParams.get('currentDocument.exists');
   if(expected&&expected!==before?.updateTime||exists==='false'&&before||exists==='true'&&!before)return Response.json({error:'conflict'},{status:412});
   const patch=JSON.parse(options.body).fields;
   const doc={name:'projects/local/databases/(default)/documents/'+relative,fields:{...before?.fields,...patch},updateTime:new Date(Date.parse('2026-10-25T00:00:00Z')+revision++).toISOString()};docs.set(relative,doc);
   if(fail.sourceAfterWrite){fail.sourceAfterWrite--;throw Error('Injected lost Firestore acknowledgement');}
   return Response.json(doc);
  }
  if(method==='GET'){
   if(relative.includes('/'))return docs.has(relative)?Response.json(docs.get(relative)):Response.json({error:'missing'},{status:404});
   return Response.json({documents:[...docs].filter(([key])=>key.startsWith(relative+'/')).map(([,doc])=>doc)});
  }
  throw Error('Unexpected mocked Firestore method '+method);
 }
 return {env,kv,docs,counts,all,fail,network,
  reset(){for(const key of Object.keys(counts))delete counts[key];all.length=0;},
  evict(){actors.delete(actorName);},
  async alarm(){const state=states.get(actorName);if(!state||await state.storage.getAlarm()===null)return false;await state.storage.deleteAlarm();if(!actors.has(actorName))create(actorName);await actors.get(actorName).alarm();return true;},
  snapshot(){const row=states.get(actorName)?.database.prepare('SELECT value FROM shared_action138 WHERE slot=1').get();return row?JSON.parse(row.value):null;},
  packet(kind='public'){return JSON.parse(kv.get('territorio:'+kind+':v1'));},
  async call(worker,path='/superadmin/territory',options={}){
   const {method='GET',body,role='SUPERADMIN_PRINCIPAL',headers={},auth=true}=options;
   const request=new Request('https://local.invalid'+path,{method,headers:{...(auth?{Authorization:'Bearer '+session(role)}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
   const response=await worker.fetch(request,env),result=await response.json(),raw=response.headers.get('X-GLD-Consumption');
   return {response,result,status:response.status,consumption:raw?JSON.parse(decodeURIComponent(raw)):null};
  }
 };
}
