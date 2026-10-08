/** Lecturas privadas del panel. Listas por propietario y cambios por documento. */
const fields={anunciantes_sedes:'anunciante_id',farmacias_ciclos:'anunciante_id',farmacias_ciclo_sedes:'ciclo_id',publicidades:'anunciante_id',publicidad_media:'publicidad_id',publicidad_segmentacion:'publicidad_id'};
const text=v=>String(v??'').trim();
const queryKey=(c,v)=>'panel:query:v48:'+c+':'+encodeURIComponent(text(v));
const advertiserKey=id=>'panel:record:v53:anunciantes:'+encodeURIComponent(text(id));
const docKey=id=>'panel:record:v48:publicidad_cambios:'+encodeURIComponent(text(id));
export function withPanelCacheV48(db,env){
  const kv=env.GLD_CACHE_KV,known=new Map(),changes=new Map(),records=new Map(),pending=new Map();
  const copy=x=>x==null?x:structuredClone(x);
  function remember(c,rows){for(const row of rows||[])if(row&&row.id)known.set(c+'/'+text(row.id),copy(row));return rows;}
  async function read(key){if(!kv?.get)return null;const raw=await kv.get(key,{cacheTtl:30});if(!raw)return null;try{const p=JSON.parse(raw);return p?.version===48?p:null;}catch(_){return null;}}
  async function optionalSave(key,value){if(kv?.put)try{await kv.put(key,JSON.stringify({version:48,...value}));}catch(_){}}
  async function requiredSave(key,value){if(!kv?.put)return;try{await kv.put(key,JSON.stringify(value));}catch(_){await new Promise(r=>setTimeout(r,1100));await kv.put(key,JSON.stringify(value));}}
  async function merge(key,packet){
    const marker=await read(key+':changes');
    const own=[...changes.values()].filter(c=>c.key===key);
    if(!marker&&!own.length)return packet.data;
    if(marker&&packet.revision===marker.revision&&!own.length)return packet.data;
    const byId=new Map(packet.data.map(row=>[text(row.id),row]));
    if(marker&&kv?.list){let cursor;do{const page=await kv.list({prefix:key+':delta:',...(cursor?{cursor}:{})});for(const item of page.keys){const change=await read(item.name);if(change){if(change.deleted)byId.delete(change.id);else byId.set(change.id,change.data);}}cursor=page.list_complete?null:page.cursor;}while(cursor);}
    for(const c of own){if(c.deleted)byId.delete(c.id);else byId.set(c.id,c.data);}
    const data=[...byId.values()];
    if(marker&&!own.length)await optionalSave(key,{data,revision:Date.now()-marker.updated_at>60000?marker.revision:''});
    return data;
  }
  async function panelQuery(c,field,value,limit=500){
    if(fields[c]!==field||Number(limit)!==500)return db.queryEqual(c,field,value,limit);
    const key=queryKey(c,value);
    if(pending.has(key))return copy(await pending.get(key));
    const operation=(async()=>{let packet=await read(key);if(!Array.isArray(packet?.data)){const data=remember(c,await db.queryEqual(c,field,value,500));packet={version:48,data,revision:''};await optionalSave(key,packet);}return remember(c,await merge(key,packet));})();
    pending.set(key,operation);try{return copy(await operation);}finally{pending.delete(key);}
  }
  async function panelGet(c,id){
    if(c==='anunciantes_administracion'&&db.panelAdministration)return db.panelAdministration(id);
    if(!['publicidad_cambios','anunciantes'].includes(c))return db.get(c,id);
    const key=c==='anunciantes'?advertiserKey(id):docKey(id);if(records.has(key))return copy(records.get(key));
    const hit=await read(key);if(hit)return copy(hit.data);
    const data=await db.get(c,id);await optionalSave(key,{data});return data;
  }
  async function beforeMutation(c,id,patch,options){
    if(!fields[c])return null;
    const k=c+'/'+text(id);
    // Creaciones declaradas por el módulo no requieren leer un ID recién generado.
    if(!known.has(k)&&!options.newDocument){const old=await db.get(c,id);known.set(k,copy(old));}
    return copy(known.get(k)||null);
  }
  function queue(c,id,old,row){
    const field=fields[c];if(!field)return;
    const prior=text(old?.[field]),next=text(row?.[field]);
    if(prior&&prior!==next){const key=queryKey(c,prior);changes.set(key+':delta:'+text(id),{key,id:text(id),deleted:true});}
    if(next){const key=queryKey(c,next);changes.set(key+':delta:'+text(id),{key,id:text(id),deleted:false,data:{...row,id:text(id)}});}
    known.set(c+'/'+text(id),copy(row));
  }
  async function flush(){
    const affected=new Set();
    for(const [key,change]of changes){affected.add(change.key);try{await requiredSave(key,{version:48,...change});}catch(error){if(kv?.delete)await kv.delete(change.key);throw error;}}
    for(const key of affected){try{await requiredSave(key+':changes',{version:48,revision:crypto.randomUUID(),updated_at:Date.now()});}catch(error){if(kv?.delete)await kv.delete(key);throw error;}}
    changes.clear();
    for(const [key,data]of records){try{await requiredSave(key,{version:48,data});}catch(error){if(kv?.delete)await kv.delete(key);throw error;}}
    records.clear();
    if(db.flushLoginCache)await db.flushLoginCache();
  }
  return {...db,
    rememberPanelRows(c,rows){if(fields[c])remember(c,rows);},
    async prepareNewPanelList(c,field,value){if(fields[c]===field)await optionalSave(queryKey(c,value),{data:[],revision:''});},
    panelReadDb(){return {...db,get:panelGet,queryEqual:panelQuery};},
    flushLoginCache:flush,
    async get(c,id){const row=await db.get(c,id);if(fields[c])known.set(c+'/'+text(id),copy(row));return row;},
    async queryEqual(...args){return remember(args[0],await db.queryEqual(...args));},
    async patch(c,id,patch,options={}){
      const old=await beforeMutation(c,id,patch,options);
      if(['publicidad_cambios','anunciantes'].includes(c)&&kv?.delete)await kv.delete(c==='anunciantes'?advertiserKey(id):docKey(id));
      const row=await db.patch(c,id,patch,options);queue(c,id,old,{...old,...patch,...row,id:text(id)});
      if(['publicidad_cambios','anunciantes'].includes(c))records.set(c==='anunciantes'?advertiserKey(id):docKey(id),row||{...patch,id:text(id)});
      return row;
    },
    async delete(c,id,options={}){
      const old=await beforeMutation(c,id,null,options);
      if(['publicidad_cambios','anunciantes'].includes(c)&&kv?.delete)await kv.delete(c==='anunciantes'?advertiserKey(id):docKey(id));
      const result=await db.delete(c,id,options);queue(c,id,old,null);
      if(['publicidad_cambios','anunciantes'].includes(c))records.set(c==='anunciantes'?advertiserKey(id):docKey(id),null);
      return result;
    }
  };
}
