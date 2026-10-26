import './build-farmacias139.mjs';
import {readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';
let source=readFileSync(new URL('./login-farmacias139.mjs',import.meta.url),'utf8');if(createHash('sha256').update(source).digest('hex')!=='e5ad7d9d51f23b1e88ac252a550ed9366dd22098ef273a106c377ae631d0ca9d')throw Error('Base139 changed');
const begin=source.indexOf('class GldPublicCache119 {'),end=source.indexOf('function coordinatedCities119',begin);let block=source.slice(begin,end);
const methods=` efemChunks140(){this.sql.exec('CREATE TABLE IF NOT EXISTS efem_chunks140 (id INTEGER PRIMARY KEY,value TEXT NOT NULL)');}
 efemSnapshot140(packet){
  const serialized=JSON.stringify(packet);
  if(new TextEncoder().encode(serialized).byteLength<=1500000){if(this.efemHadChunks140){this.efemChunks140();this.query('DELETE FROM efem_chunks140');}return serialized;}
  this.efemChunks140();this.efemHadChunks140=true;
  const bytes=new TextEncoder().encode(serialized),decoder=new TextDecoder();let parts=[];
  for(let i=0;i<bytes.length;i+=1000000)parts.push(decoder.decode(bytes.subarray(i,i+1000000),{stream:i+1000000<bytes.length}));
  this.query('DELETE FROM efem_chunks140');
  parts.forEach((value,id)=>this.query('INSERT INTO efem_chunks140(id,value) VALUES(?,?)',id,value));
  const {efemerides,...meta}=packet;return JSON.stringify({...meta,__efem_packet140:{parts:parts.length,updated_at:packet.updated_at||''}});
 }
 readEfemSnapshot140(manifest){
  if(!Number.isInteger(manifest.parts)||manifest.parts<1)throw Error('Invalid Efemerides packet manifest');
  this.efemChunks140();this.efemHadChunks140=true;
  const chunks=this.query('SELECT id,value FROM efem_chunks140 ORDER BY id');
  if(chunks.length!==manifest.parts||chunks.some((row,i)=>row.id!==i))throw Error('Incomplete persistent Efemerides packet');
  const packet=JSON.parse(chunks.map(row=>row.value).join(''));
  if(!Array.isArray(packet.efemerides))throw Error('Invalid persistent Efemerides packet');return packet;
 }
`;
block=block.replace(' async read(key,def){',methods+' async read(key,def){');
block=block.replace("  if(def.module==='guide'&&Array.isArray(stored[def.field])){",`  if(def.module==='efemerides'&&stored.__efem_packet140&&stored.__efem_packet140.updated_at===(stored.updated_at||'')){
   trace.source='saved-chunked-packet';const result=this.readEfemSnapshot140(stored.__efem_packet140);if(JSON.stringify(result).length<2000000)this.cached=result;return result;
  }
  if(['guide','efemerides'].includes(def.module)&&Array.isArray(stored[def.field])){`);
const insert="  if(JSON.stringify(result).length<2000000)this.cached=result;";
block=block.replace(insert,`  if(def.module==='efemerides'){
   try{this.state.storage.transactionSync(()=>{const snapshot=this.efemSnapshot140(result);this.query('UPDATE packet SET value=? WHERE slot=1',snapshot);});}
   catch(error){console.warn(JSON.stringify({event:'gld_efemerides_snapshot_deferred',error:String(error?.message||error)}));}
  }
`+insert);
block=block.replace("const snapshot=def.module==='guide'?this.guideSnapshot135({...meta,[def.field]:rows}):null;","const snapshot=def.module==='efemerides'?this.efemSnapshot140({...meta,[def.field]:rows}):def.module==='guide'?this.guideSnapshot135({...meta,[def.field]:rows}):null;");
block=block.replace("const snapshot=def.module==='guide'?this.guideSnapshot135(nextPacket):null;","const snapshot=def.module==='efemerides'?this.efemSnapshot140(nextPacket):def.module==='guide'?this.guideSnapshot135(nextPacket):null;");
block=block.replace("this.query('UPDATE entities SET value=NULL');this.query('UPDATE packet SET deleted=1 WHERE slot=1');return;","this.query('UPDATE entities SET value=NULL');if(def.module==='efemerides'&&this.efemHadChunks140){this.efemChunks140();this.query('DELETE FROM efem_chunks140');}this.query('UPDATE packet SET deleted=1 WHERE slot=1');return;");
source=source.slice(0,begin)+block+source.slice(end);
const anchor='    if (["efemerides", "publicas", "public"].includes(action)) {\n      const out2 = await efemeridesPublicV3({';if(source.split(anchor).length!==2)throw Error('Efemerides route anchor changed');
source=source.replace(anchor,`    if(action==='calendario'){
      const base=await getEfemCityV2({cache,cityId:text23(url.searchParams.get('ciudad_id'))});
      if(base.status)return json(base,base.status);
      if(base.cold)return json({success:false,message:'Calendario todavía no publicado para esta ciudad.'},503);
      const payload=JSON.stringify(base.efemerides||[]),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload));
      const revision=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
      const unchanged=url.searchParams.get('revision')===revision;
      return json({success:true,ciudad_id:base.ciudad_id,revision,unchanged,...(unchanged?{}:{efemerides:base.efemerides||[]})},200,{'Cache-Control':'no-store'});
    }
`+anchor);
source=source.replaceAll("worker_version:'139'","worker_version:'140'").replace('version:"139"','version:"140"');
writeFileSync(new URL('./login-efemerides140.mjs',import.meta.url),source);console.log(JSON.stringify({version:140,bytes:Buffer.byteLength(source),sha256:createHash('sha256').update(source).digest('hex')}));
