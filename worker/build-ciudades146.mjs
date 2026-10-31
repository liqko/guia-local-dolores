import './build-eventos145.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
let s=readFileSync(new URL('./login-eventos145.mjs',import.meta.url),'utf8');
function once(a,b){const n=s.split(a).length-1;if(n!==1)throw Error('Ancla inesperada ('+n+'): '+a.slice(0,70));s=s.replace(a,b);}
once("if(edit&&method==='PATCH')return {kind:edit[1],id:decodeURIComponent(edit[2])};",
"if(edit&&method==='PATCH')return {kind:edit[1],id:decodeURIComponent(edit[2])};\n  if(edit&&method==='DELETE'&&edit[1]==='cities')return {kind:'delete_city',id:decodeURIComponent(edit[2])};");
once("  const db={\n   async patch(collection,id,patch){",
"  const sourceRows146=new Map();\n  const db={\n   async queryEqual(collection,field,value,limit){\n    const rows=await resources.db.queryEqual(collection,field,value,limit);\n    for(const row of rows)sourceRows146.set(collection+'/'+String(row.id),clone(row));\n    return rows;\n   },\n   async delete(collection,id){\n    const before=collection==='ciudades'?(packets.admin?.ciudades||[]).find(row=>String(row.ciudad_id||row.id)===String(id)):sourceRows146.get(collection+'/'+String(id));\n    if(!before)throw Object.assign(Error('Registro no encontrado: '+collection+'/'+id),{status:409});\n    writes.push({collection,id:String(id),remove:true,before:clone(before)});\n    return true;\n   },\n   async patch(collection,id,patch){");
once("  keys:()=>({admin:ADMIN_KEY,public:PUBLIC_KEY}),",
"  keys:(command)=>{const id=command?.path?.split('/').pop()||'';return {admin:ADMIN_KEY,public:PUBLIC_KEY,...(command?.method==='DELETE'?{guideCity:'guide:city:v1:'+id,eventsCity:'events:city:v2:'+id,activitiesCity:'activities:city:v2:'+id,promosCity:'promos:city:v1:'+id,publicityCity:'publicity:city:v2:'+id,farmOldCity:'farmacias:city:v1:'+id,farmNewCity:'farmacias:city:v2:'+id,efemCity:'efemerides:city:v1:'+id}:{})};},");
s=s.replaceAll("Object.entries(this.adapter.keys()).find","Object.entries(this.adapter.keys(job.command)).find");
once("  const args={env:resources.env,request,db,cache,idFromPath:spec.id||''};",
"  const args={env:resources.env,request,db,cache,idFromPath:spec.id||'',skipDependencies146:!!resolved};");
once("  const fn=spec.kind==='rebuild'?rebuildTerritory:spec.kind==='countries'?saveCountry:spec.kind==='provinces'?saveProvince:saveCity;",
"  const fn=spec.kind==='rebuild'?rebuildTerritory:spec.kind==='delete_city'?deleteCity146:spec.kind==='countries'?saveCountry:spec.kind==='provinces'?saveProvince:saveCity;");
once("     if(recovering){\n      const current=await res.db.getVersioned(write.collection,write.id);",
"     if(recovering&&!write.remove){\n      const current=await res.db.getVersioned(write.collection,write.id);");
once("     if(!row)row=await res.db.patch(write.collection,write.id,write.patch,options);\n     saved[write.collection+'/'+write.id]=row;",
"     if(write.remove){\n       if(recovering){const current=await res.db.getVersioned(write.collection,write.id);\n         if(current.doc&&Object.keys(write.before||{}).some(k=>k!=='actualizado_en'&&!equal(current.doc[k],write.before[k])))throw Object.assign(Error('La ciudad cambió durante la recuperación.'),{status:409});\n         if(current.doc)await res.db.delete(write.collection,write.id);\n       }else await res.db.delete(write.collection,write.id);\n       saved[write.collection+'/'+write.id]=null;\n     }else{\n       if(!row)row=await res.db.patch(write.collection,write.id,write.patch,options);\n       saved[write.collection+'/'+write.id]=row;\n     }");
once("  if(!['SUPERADMIN_PRINCIPAL','SUPERADMIN'].includes(auth.rol))return json({success:false,message:'El acceso de moderador está limitado a las publicaciones y ciudades asignadas.'},403);",
"  if((identify(ctx.path,ctx.request.method)?.kind==='delete_city'||(identify(ctx.path,ctx.request.method)?.kind==='cities'&&ctx.request.method==='POST'))&&auth.rol!=='SUPERADMIN_PRINCIPAL')return json({success:false,message:'Solo el administrador principal puede eliminar ciudades.'},403);\n  if(!['SUPERADMIN_PRINCIPAL','SUPERADMIN'].includes(auth.rol))return json({success:false,message:'El acceso de moderador está limitado a las publicaciones y ciudades asignadas.'},403);");
once('  if (path === "/superadmin/cities/create" && request2.method === "POST") return saveCity({ env, request: request2, db, cache });',
'  if (path === "/superadmin/cities/create" && request2.method === "POST") return saveCity({ env, request: request2, db, cache });\n  if (/^\\/superadmin\\/cities\\/[^/]+$/.test(path) && request2.method === "DELETE") return deleteCity146({env,request:request2,db,cache,idFromPath:decodeURIComponent(path.split("/").pop())});');
once('async function rebuildTerritory(ctx){',
readFileSync(new URL('./modules/city-delete146.js',import.meta.url),'utf8')+'\nasync function rebuildTerritory(ctx){');
s=s.replaceAll("worker_version:'145'","worker_version:'146'");
writeFileSync(new URL('./login-ciudades146.mjs',import.meta.url),s);
console.log(JSON.stringify({version:146,bytes:Buffer.byteLength(s),sha256:createHash('sha256').update(s).digest('hex')}));
