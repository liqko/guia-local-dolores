'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../../worker/worker206.txt'),'utf8');
const block=src.slice(src.indexOf('// Unidades 2 y 7: estado público del anunciante.'),src.indexOf('// Todo anunciante nuevo recibe el nivel 3'));
const f=new Function(block+';return {validityRule155,validityDays155,publicValidity155,validityStart155,validityOnOwner155,validityOnContract155,validityRenew155,advertiserPublicState155,guideCardVisible155,argentinaDay155,addDays155};')();
const at=Date.parse('2026-11-27T15:00:00Z'),today='2026-11-27';
test('un único mecanismo define la vigencia de los seis niveles',()=>{
 for(const [nivel,con,dias] of [['1',true,90],['1',false,0],['2',true,90],['2',false,0],['3',true,30],['3',false,0],['4',false,90],['5',true,90],['6',false,90],['7',true,0],['',true,0]])
  assert.equal(f.validityDays155({nivel,con_titular:con}),dias,nivel+'/'+con);
 assert.equal((src.match(/ADVERTISER_VALIDITY155=/g)||[]).length,1);
 assert.doesNotMatch(src,/renewalDays155|initialValidity155/);
});
test('niveles 1-3: la asignación del titular inicia la vigencia; editar o transferir no la reinicia',()=>{
 assert.deepEqual(f.validityStart155({nivel:'3',con_titular:true},at),{vigencia_desde:today,vigencia_hasta:'2026-12-27'});
 assert.deepEqual(f.validityStart155({nivel:'1',con_titular:true},at),{vigencia_desde:today,vigencia_hasta:'2027-02-25'});
 assert.deepEqual(f.validityStart155({nivel:'3',con_titular:true,vigencia_hasta:'2026-12-01'},at),{});
 assert.deepEqual(f.validityStart155({nivel:'3',con_titular:false},at),{});
 assert.deepEqual(f.validityOnOwner155({nivel:'5',con_titular:true},at),{},'niveles 4-6 no inician vigencia por asignar titular');
 assert.deepEqual(f.validityOnOwner155({nivel:'2',con_titular:true},at),{vigencia_desde:today,vigencia_hasta:'2027-02-25'});
 assert.equal(f.publicValidity155({nivel:'3',con_titular:false,vigencia_hasta:'2020-01-01'}),'','sin titular no vence');
});
test('niveles 4-6: 90 días desde cada contratación; 1-3 no reinician por contratar',()=>{
 assert.deepEqual(f.validityOnContract155({nivel:'5',vigencia_hasta:'2027-01-10'},at),{vigencia_desde:today,vigencia_hasta:'2027-02-25'});
 assert.deepEqual(f.validityOnContract155({nivel:'3',con_titular:true,vigencia_hasta:'2026-12-01'},at),{});
 assert.deepEqual(f.validityOnContract155({nivel:'3',con_titular:true,vigencia_hasta:'2026-11-01'},at),{vigencia_desde:today,vigencia_hasta:'2026-12-27'});
 assert.deepEqual(f.validityOnContract155({nivel:'2',con_titular:false},at),{});
});
test('renovar suma el período del nivel desde la vigencia vigente o desde hoy si venció',()=>{
 assert.deepEqual(f.validityRenew155({nivel:'3',con_titular:true,vigencia_hasta:'2026-12-01'},at),{vigencia_hasta:'2026-12-31'});
 assert.deepEqual(f.validityRenew155({nivel:'2',con_titular:true,vigencia_hasta:'2026-10-01'},at),{vigencia_hasta:'2027-02-25',vigencia_desde:today});
 assert.equal(f.validityRenew155({nivel:'3',con_titular:false},at),null);
});
test('estado público: prioridad y vencimiento sin eliminar datos ni tocar el panel',()=>{
 assert.equal(f.advertiserPublicState155({aprobado:false,inactivo_motivo:'VOLUNTARIA'},undefined,undefined,at).motivo,'BLOQUEO_ADMINISTRATIVO');
 assert.equal(f.advertiserPublicState155({inactivo_motivo:'VOLUNTARIA'},undefined,undefined,at).motivo,'DESACTIVACION_VOLUNTARIA');
 assert.equal(f.advertiserPublicState155({nivel:'5',vigencia_hasta:'2026-11-26'},undefined,undefined,at).motivo,'VENCIDO');
 assert.equal(f.advertiserPublicState155({nivel:'3',con_titular:false,vigencia_hasta:'2020-01-01'},undefined,undefined,at).visible,true);
 assert.equal(f.advertiserPublicState155({nivel:'3',con_titular:true,vigencia_hasta:today},undefined,undefined,at).visible,true);
 assert.equal(f.advertiserPublicState155({nivel:'3'},{nombre:''},[],at).motivo,'FICHA_INCOMPLETA');
});
test('la tarjeta publicada vence en el corte sin reescribirla y el publicador agenda la fecha',()=>{
 const cut=Date.parse('2026-11-28T04:00:00Z');
 assert.equal(f.guideCardVisible155({vigente_hasta:'2026-11-27'},at),true);
 assert.equal(f.guideCardVisible155({vigente_hasta:'2026-11-27'},cut),false,'oculta en el corte de 01:00 siguiente');
 assert.equal(f.guideCardVisible155({inactivo_motivo:'VOLUNTARIA'},at),false);
 assert.equal(f.guideCardVisible155({aprobado:false},at),false);assert.equal(f.guideCardVisible155({},at),true);
 assert.match(src,/guide:\{rebuild:rebuildGuideAllV2,validity:true,/);
 assert.match(src,/guidePublic\(\{ url, cache, at: cityBookCutoff \}\)/);
 assert.match(src,/\.\.\.\(publicValidity155\(admin\) \? \{ vigente_hasta: publicValidity155\(admin\) \} : \{\}\)/);
});
