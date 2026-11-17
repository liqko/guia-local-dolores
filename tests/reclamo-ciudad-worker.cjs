const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('worker/worker206.txt','utf8');
function harness(rows,authenticated=true){
 const context={URL,Response,ownerTeamRoute159:async()=>null,verifySubscriberSession:async()=>({ok:authenticated}),json:(data,status=200)=>Response.json(data,{status}),norm6:x=>String(x).toLowerCase(),ADMIN_ADVERTISERS_KEY:'index'};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function routeAdvertiserAccess155('),source.indexOf('\nfunction roleName159(')),context);
 return query=>context.routeAdvertiserAccess155({path:'/advertisers/claim-options',request:{method:'GET'},env:{},db:{},url:new URL('https://fixture.invalid/?'+query),cache:{get:async()=>({results:rows})}});
}
test('Ciudad se filtra antes del límite y combina nombre o ID; llamada anterior sigue funcionando',async()=>{
 const rows=Array.from({length:110},(_,i)=>({id:'CAS-'+i,nombre:'Comercio '+i,ciudad_ids:['CAS']}));rows.push({id:'DOL-1',nombre:'Magnolia',ciudad_ids:['DOL']},{id:'DOL-2',nombre:'Otra tienda',ciudad_ids:['DOL']},{id:'OCULTO',nombre:'Magnolia',ciudad_ids:['DOL'],aprobado:false});
 const run=harness(rows);let j=await (await run('ciudad_id=DOL')).json();assert.equal(j.results.length,2);assert.equal(j.hay_mas,false);
 j=await (await run('ciudad_id=DOL&q=magnolia')).json();assert.deepEqual(j.results.map(x=>x.id),['DOL-1']);
 j=await (await run('ciudad_id=CAS&q=DOL-1')).json();assert.equal(j.results.length,0);
 j=await (await run('q=DOL-1')).json();assert.equal(j.results[0].id,'DOL-1');
 j=await (await run('')).json();assert.equal(j.results.length,100);assert.equal(j.hay_mas,true);
});
test('El catálogo de reclamo mantiene autenticación personal',async()=>{assert.equal((await harness([],false)('ciudad_id=DOL')).status,401);});
test('Solo RECLAMAR omite términos de publicación; CREAR sigue exigiéndolos',async()=>{
 const context={GLD_ACTIONS138:{readJson:async r=>r.body},verifySubscriberSession:async()=>({ok:true,sid:'fixture'}),currentTermsV81:async()=>({version:'actual'}),PUBLICATION_TERMS_V77:'actual',publicationErrorV77:message=>{throw Error(message);}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function preparePublicationV77('),source.indexOf('// Revisiones delegadas.')),context);
 const ctx=modo=>({path:'/suscriptores',request:{method:'POST',body:{action:'solicitar_anunciante',modo}},url:new URL('https://fixture.invalid/'),env:{},cache:{},db:{}});
 await context.preparePublicationV77(ctx('RECLAMAR'));
 await assert.rejects(context.preparePublicationV77(ctx('CREAR')),/términos de publicación/);
});
