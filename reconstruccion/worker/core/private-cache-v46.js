/** Caché privada del login y favoritos, mantenida por mutaciones. No guarda contraseñas ni sustituye la autenticación. */
const text=v=>String(v??'').trim();
const relationKey=sid=>'login:relations:v45:'+text(sid);
const recordKey=(collection,id)=>'login:record:v45:'+collection+':'+text(id);
const favoriteKey=sid=>'subscriber:favorites:v46:'+text(sid);
const advertiserCollections=new Set(['anunciantes','anunciantes_administracion']);

export function withPrivateCacheV46(db,env){
  const kv=env.GLD_CACHE_KV;
  const owners=new Map();
  const dirty=new Set();
  const favoriteChanges=new Map();
  const deletedSubscribers=new Set();
  const favoriteDelta=(sid,id)=>favoriteKey(sid)+':delta:'+text(id);
  async function putRequired(key,value){
    try{await kv.put(key,value)}catch(first){await new Promise(resolve=>setTimeout(resolve,1100));await kv.put(key,value)}
  }
  function remember(collection,rows){
    if(['suscriptor_anunciante','suscriptor_favoritos'].includes(collection))for(const row of rows||[]){
      const id=text(row.id||row.suscriptor_anunciante_id||row.favorito_id),sid=text(row.suscriptor_id);
      if(id&&sid)owners.set(collection+'/'+id,sid);
    }
    return rows;
  }
  async function revision(key){
    if(!kv||typeof kv.get!=='function')return 'initial';
    return text(await kv.get(key+':revision',{cacheTtl:30}))||'initial';
  }
  async function read(key){
    const rev=await revision(key);
    if(!kv||typeof kv.get!=='function')return {packet:null,rev};
    const raw=await kv.get(key+':'+rev,{cacheTtl:30});
    if(!raw)return {packet:null,rev};
    try{const packet=JSON.parse(raw);
      if(packet&&packet.version===46)return {packet,rev};
      if(packet&&packet.version===45&&Number(packet.expires_at)>Date.now()){await save(key,packet.data,rev);return {packet,rev};}
      return {packet:null,rev};
    }catch(_){return {packet:null,rev}}
  }
  async function save(key,data,rev,meta={}){
    // Llenado opcional. Una falla deja la caché fría, sin romper el login.
    if(!kv||typeof kv.put!=='function'||dirty.has(key))return;
    try{await kv.put(key+':'+rev,JSON.stringify({version:46,data,...meta}))}catch(_){}
  }
  async function invalidate(key){
    const rev=await revision(key);
    if(kv&&typeof kv.delete==='function')await kv.delete(key+':'+rev);
    else if(kv&&(await read(key)).packet)throw Error('KV debe permitir invalidar la caché privada.');
    dirty.add(key);
  }
  async function flush(){
    // Cada favorito tiene su propia entrada: dos cambios de favoritos distintos
    // nunca sustituyen la lista del otro. Las bajas se conservan como tombstones.
    const updatedSubscribers=new Set();
    for(const [key,change] of favoriteChanges){
      try{if(kv&&kv.put)await putRequired(key,JSON.stringify(change));}
      catch(error){if(kv&&kv.delete)await kv.delete(key);await invalidate(favoriteKey(change.sid));throw error;}
      updatedSubscribers.add(change.sid);
      favoriteChanges.delete(key);
    }
    for(const sid of updatedSubscribers)if(kv&&kv.put){try{await putRequired(favoriteKey(sid)+':changes',JSON.stringify({revision:crypto.randomUUID(),updated_at:Date.now()}));}catch(error){await invalidate(favoriteKey(sid));throw error;}}
    for(const key of dirty){
      if(kv&&kv.put)await putRequired(key+':revision',crypto.randomUUID());
      dirty.delete(key);
    }
    for(const sid of deletedSubscribers){
      if(kv&&kv.list&&kv.delete){const keys=[];let cursor;do{const page=await kv.list({prefix:favoriteKey(sid)+':',...(cursor?{cursor}:{})});keys.push(...page.keys.map(k=>k.name));cursor=page.list_complete?null:page.cursor;}while(cursor);await Promise.all(keys.map(key=>kv.delete(key)));}
      deletedSubscribers.delete(sid);
    }
  }
  async function relationOwners(id,patch,options){
    // Si el router no cargó el vínculo, leer sólo ese documento para conocer
    // también su propietario anterior. Nunca barrer la colección.
    if(!owners.has('suscriptor_anunciante/'+text(id))){const previous=await db.get('suscriptor_anunciante',id);if(previous)remember('suscriptor_anunciante',[previous]);}
    const set=new Set([owners.get('suscriptor_anunciante/'+text(id)),text(patch&&patch.suscriptor_id),text(options&&options.subscriberId)].filter(Boolean));
    if(!set.size)throw Error('Falta contexto de suscriptor para invalidar su relación.');
    return set;
  }
  async function prepareFavorite(sid,id){
    const key=favoriteDelta(sid,id);
    return key;
  }
  async function overlayFavorites(sid,rows,packet,rev){
    if(!kv||typeof kv.list!=='function')return rows;
    const rawMarker=await kv.get(favoriteKey(sid)+':changes',{cacheTtl:30});
    if(!rawMarker)return rows;
    const marker=JSON.parse(rawMarker);
    if(packet&&packet.delta_revision===marker.revision)return rows;
    const byId=new Map(rows.map(r=>[text(r.id||r.favorito_id),r]));
    let cursor;
    do{
      const page=await kv.list({prefix:favoriteKey(sid)+':delta:',...(cursor?{cursor}:{})});
      const changes=await Promise.all(page.keys.map(async entry=>{const raw=await kv.get(entry.name,{cacheTtl:30});return raw?JSON.parse(raw):null}));
      for(const change of changes){if(!change||change.sid!==sid)continue;if(change.deleted)byId.delete(change.id);else byId.set(change.id,change.data);}
      cursor=page.list_complete?null:page.cursor;
    }while(cursor);
    for(const change of favoriteChanges.values())if(change.sid===sid){if(change.deleted)byId.delete(change.id);else byId.set(change.id,change.data);}
    const merged=[...byId.values()];
    // Durante propagación de KV repetir sólo el merge de KV. Nunca Firestore.
    await save(favoriteKey(sid),merged,rev,{delta_revision:Date.now()-Number(marker.updated_at)>60000?marker.revision:''});
    return merged;
  }
  return {
    ...db,
    flushLoginCache:flush,
    async get(collection,id){const row=await db.get(collection,id);if(row)remember(collection,[row]);return row;},
    async queryEqual(...args){return remember(args[0],await db.queryEqual(...args));},
    async patch(collection,id,patch,options={}){
      if(advertiserCollections.has(collection))await invalidate(recordKey(collection,id));
      let affected=[];
      if(collection==='suscriptor_anunciante'){
        affected=[...await relationOwners(id,patch,options)];
        for(const sid of affected)await invalidate(relationKey(sid));
      }
      let favKey;
      if(collection==='suscriptor_favoritos'){const sid=text(patch.suscriptor_id)||owners.get(collection+'/'+text(id));if(!sid)throw Error('Falta suscriptor del favorito.');favKey=await prepareFavorite(sid,id);}
      const row=await db.patch(collection,id,patch,options);
      if(favKey)favoriteChanges.set(favKey,{sid:text(patch.suscriptor_id)||owners.get(collection+'/'+text(id)),id:text(id),deleted:false,data:{...patch,...row,id:text(id)}});
      if(row)remember(collection,[row]);
      return row;
    },
    async delete(collection,id,options={}){
      if(advertiserCollections.has(collection))await invalidate(recordKey(collection,id));
      if(collection==='suscriptor_anunciante')for(const sid of await relationOwners(id,null,options))await invalidate(relationKey(sid));
      let favKey;
      if(collection==='suscriptor_favoritos'){let sid=owners.get(collection+'/'+text(id))||text(options.subscriberId);if(!sid){const previous=await db.get(collection,id);if(previous){remember(collection,[previous]);sid=text(previous.suscriptor_id);}}if(sid)favKey=await prepareFavorite(sid,id);}
      if(collection==='suscriptores'){deletedSubscribers.add(text(id));await invalidate(relationKey(id));await invalidate(favoriteKey(id));for(const [key,change]of favoriteChanges)if(change.sid===text(id))favoriteChanges.delete(key);}
      const result=await db.delete(collection,id,options);
      if(favKey)favoriteChanges.set(favKey,{sid:owners.get(collection+'/'+text(id))||text(options.subscriberId),id:text(id),deleted:true});
      return result;
    },
    async subscriberFavorites(sid){
      const key=favoriteKey(sid);
      const {packet,rev}=await read(key);
      if(packet&&Array.isArray(packet.data)&&!dirty.has(key))return remember('suscriptor_favoritos',await overlayFavorites(sid,packet.data,packet,rev));
      const rows=remember('suscriptor_favoritos',await db.queryEqual('suscriptor_favoritos','suscriptor_id',sid,500));
      await save(key,rows,rev);return remember('suscriptor_favoritos',await overlayFavorites(sid,rows,null,rev));
    },
    async loginRelations(sid){
      const key=relationKey(sid),{packet:hit,rev}=await read(key);
      if(hit&&Array.isArray(hit.data)&&!dirty.has(key))return remember('suscriptor_anunciante',hit.data);
      const rows=remember('suscriptor_anunciante',await db.queryEqual('suscriptor_anunciante','suscriptor_id',sid,100));
      // Almacenar solamente los campos que usa el login.
      await save(key,rows.map(r=>({id:text(r.id||r.suscriptor_anunciante_id),suscriptor_id:text(r.suscriptor_id),anunciante_id:text(r.anunciante_id),anunciante_nombre:text(r.anunciante_nombre),rol:text(r.rol),permisos:text(r.permisos),activo:r.activo})),rev);
      return rows;
    },
    async loginAdvertiser(collection,id){
      if(!advertiserCollections.has(collection))throw Error('Colección no admitida para caché del login.');
      const key=recordKey(collection,id),{packet:hit,rev}=await read(key);
      if(hit&&!dirty.has(key))return hit.data;
      const row=await db.get(collection,id);
      const data=row?{id:text(row.id||id),nombre:text(row.nombre),funcionalidades:row.funcionalidades}:null;
      await save(key,data,rev);
      return data;
    }
  };
}
