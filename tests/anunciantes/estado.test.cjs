'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../../worker/worker206.txt'),'utf8');
const block=src.slice(src.indexOf('// Unidades 2 y 7: estado público del anunciante.'),src.indexOf('// Todo anunciante nuevo recibe el nivel 3'));
const f=new Function(block+';return {advertiserValidityRules155,validityRule155,publicValidity155,validityOnOwner155,validityOnLevelChange155,validityOnContract155,validityRenew155,validityBeforeException155,advertiserPublicState155,guideCardVisible155};')();
const at=Date.parse('2026-11-27T15:00:00Z'),today='2026-11-27',R=f.advertiserValidityRules155([]);
const strip=o=>{const {vigencia_regla,...rest}=o||{};return rest;};
test('las reglas salen del catálogo de niveles; los valores iniciales sólo cubren niveles sin regla guardada',()=>{
 assert.deepEqual(R['1'],{con_titular:{modo:'DIAS',dias:90},sin_titular:{modo:'PERMANENTE',dias:0},excepciones:false});
 assert.deepEqual(R['3'].con_titular,{modo:'DIAS',dias:30});assert.deepEqual(R['5'].con_titular,{modo:'CONTRATACION',dias:90});assert.equal(R['6'].excepciones,true);
 const C=f.advertiserValidityRules155([{nivel_id:'CONFIG_GENERAL_ANUNCIANTES'},{nivel_id:'N3',numero:3,vigencia_con_titular_modo:'DIAS',vigencia_con_titular_dias:15,vigencia_excepciones:true},{numero:7,vigencia_sin_titular_modo:'DIAS',vigencia_sin_titular_dias:5}]);
 assert.deepEqual(C['3'],{con_titular:{modo:'DIAS',dias:15},sin_titular:{modo:'PERMANENTE',dias:0},excepciones:true});
 assert.deepEqual(C['7'].sin_titular,{modo:'DIAS',dias:5});assert.equal(C.CONFIG_GENERAL_ANUNCIANTES,undefined);
 assert.equal((src.match(/ADVERTISER_VALIDITY_INITIAL155=/g)||[]).length,1);assert.doesNotMatch(src,/ADVERTISER_VALIDITY155=|renewalDays155|initialValidity155/);
});
test('titular: inicia el período de su regla, no reinicia uno en curso y sin titular aplica la regla sin titular',()=>{
 assert.deepEqual(strip(f.validityOnOwner155({nivel:'3',con_titular:true},R,at)),{vigencia_desde:today,vigencia_hasta:'2026-12-27'});
 assert.deepEqual(f.validityOnOwner155({nivel:'3',con_titular:true,vigencia_hasta:'2026-12-01'},R,at),{});
 assert.deepEqual(strip(f.validityOnOwner155({nivel:'3',con_titular:false,vigencia_hasta:'2026-12-01'},R,at)),{vigencia_desde:'',vigencia_hasta:''},'sin titular: permanente');
 assert.deepEqual(f.validityOnOwner155({nivel:'5',con_titular:true},R,at),{},'4-6: por contratación');
 assert.deepEqual(f.validityOnOwner155({nivel:'3',con_titular:true,vigencia_excepcion:{modo:'PERMANENTE'}},R,at),{},'la excepción prevalece');
 assert.equal(f.validityOnOwner155({nivel:'3',con_titular:true},R,at).vigencia_regla.origen,'TITULAR');
});
test('cambio efectivo de nivel: aplica la regla del nuevo nivel sin contratar',()=>{
 assert.deepEqual(strip(f.validityOnLevelChange155({nivel:'3',con_titular:true,vigencia_hasta:'2027-01-10'},R,at)),{vigencia_desde:today,vigencia_hasta:'2026-12-27'});
 assert.deepEqual(f.validityOnLevelChange155({nivel:'5',con_titular:true,vigencia_hasta:'2026-12-10'},R,at),{},'por contratación: conserva la vigencia otorgada');
 assert.deepEqual(strip(f.validityOnLevelChange155({nivel:'2',con_titular:false,vigencia_hasta:'2026-12-10'},R,at)),{vigencia_desde:'',vigencia_hasta:''});
 assert.deepEqual(f.validityOnLevelChange155({nivel:'3',con_titular:true,vigencia_excepcion:{modo:'FECHA'}},R,at),{});
 assert.equal(f.validityOnLevelChange155({nivel:'1',con_titular:true},R,at).vigencia_regla.origen,'CAMBIO_NIVEL');
});
test('contratación y renovación usan la regla vigente al momento de otorgar',()=>{
 assert.deepEqual(strip(f.validityOnContract155({nivel:'5',vigencia_hasta:'2027-01-10'},R,at)),{vigencia_desde:today,vigencia_hasta:'2027-02-25'});
 assert.deepEqual(f.validityOnContract155({nivel:'3',con_titular:true,vigencia_hasta:'2026-12-01'},R,at),{});
 assert.deepEqual(f.validityOnContract155({nivel:'2',con_titular:false},R,at),{});
 assert.deepEqual(strip(f.validityRenew155({nivel:'3',con_titular:true,vigencia_hasta:'2026-12-01'},R,at)),{vigencia_hasta:'2026-12-31'});
 assert.deepEqual(strip(f.validityRenew155({nivel:'2',con_titular:true,vigencia_hasta:'2026-10-01'},R,at)),{vigencia_hasta:'2027-02-25',vigencia_desde:today});
 assert.equal(f.validityRenew155({nivel:'3',con_titular:false},R,at),null);assert.equal(f.validityRenew155({nivel:'5',con_titular:true},R,at),null);
 const C=f.advertiserValidityRules155([{numero:3,vigencia_con_titular_modo:'DIAS',vigencia_con_titular_dias:10}]);
 assert.equal(f.validityRenew155({nivel:'3',con_titular:true,vigencia_hasta:'2026-12-01'},C,at).vigencia_hasta,'2026-12-11');
});
test('una vigencia otorgada no depende de la regla actual; la excepción permanente la suspende',()=>{
 assert.equal(f.publicValidity155({nivel:'3',con_titular:false,vigencia_hasta:'2026-12-01'}),'2026-12-01');
 assert.equal(f.publicValidity155({vigencia_hasta:'2026-12-01',vigencia_excepcion:{modo:'PERMANENTE'}}),'');
 assert.equal(f.advertiserPublicState155({nivel:'5',vigencia_hasta:'2026-11-26'},undefined,undefined,at).motivo,'VENCIDO');
 assert.equal(f.advertiserPublicState155({nivel:'5',vigencia_hasta:'2026-11-26',vigencia_excepcion:{modo:'PERMANENTE'}},undefined,undefined,at).visible,true);
 assert.equal(f.advertiserPublicState155({aprobado:false},undefined,undefined,at).motivo,'BLOQUEO_ADMINISTRATIVO');
 assert.equal(f.advertiserPublicState155({nivel:'3'},{nombre:''},[],at).motivo,'FICHA_INCOMPLETA');
});
test('la tarjeta publicada vence en el corte de 01:00 sin leer reglas ni reescribirse',()=>{
 const cut=Date.parse('2026-11-28T04:00:00Z');
 assert.equal(f.guideCardVisible155({vigente_hasta:'2026-11-27'},at),true);assert.equal(f.guideCardVisible155({vigente_hasta:'2026-11-27'},cut),false);
 assert.equal(f.guideCardVisible155({inactivo_motivo:'VOLUNTARIA'},at),false);assert.equal(f.guideCardVisible155({},at),true);
 assert.match(src,/guide:\{rebuild:rebuildGuideAllV2,validity:true,/);assert.match(src,/guidePublic\(\{ url, cache, at: cityBookCutoff \}\)/);
 assert.match(src,/\.\.\.\(publicValidity155\(admin\) \? \{ vigente_hasta: publicValidity155\(admin\) \} : \{\}\)/);
});
test('Gran Hermano usa las reglas resueltas por el Worker, sin duplicar valores',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../plataforma/administracion.html'),'utf8');
 assert.match(html,/<summary><b>Vigencia y renovación de anuncios<\/b>/);
 assert.match(html,/GH_VIGENCIAS155=j\.vigencia_reglas/);assert.match(html,/if\(j\.vigencias\)GH_VIGENCIAS155=j\.vigencias/);
 assert.doesNotMatch(html,/'DIAS',90|dias:90|dias:30/);
 assert.match(src,/vigencia_reglas: advertiserValidityRules155\(rows\)/);assert.match(src,/vigencias:advertiserValidityRules155\(packet\.catalogos\.niveles_anunciante\)/);
});
test('excepción con fecha sin pisar la vigencia; regla permanente renovable; recuperación sólo con evidencia',()=>{
 assert.equal(f.publicValidity155({vigencia_hasta:'2026-12-01',vigencia_excepcion:{modo:'FECHA',hasta:'2027-03-01'}}),'2027-03-01');
 const P=f.advertiserValidityRules155([{numero:3,vigencia_con_titular_modo:'PERMANENTE'}]);
 assert.deepEqual(strip(f.validityRenew155({nivel:'3',con_titular:true,vigencia_hasta:'2026-10-01'},P,at)),{vigencia_desde:'',vigencia_hasta:''});
 assert.equal(f.validityRenew155({nivel:'3',con_titular:true},P,at),null);
 const exc={modo:'FECHA',hasta:'2027-03-01',en:'2026-11-20T10:00:00.000Z'};
 assert.equal(f.validityBeforeException155({vigencia_hasta:'2027-03-01',vigencia_excepcion:exc,renovaciones:[{en:'2026-11-10T00:00:00.000Z',hasta:'2026-12-10'},{en:'2026-11-25T00:00:00.000Z',hasta:'2027-01-01'}]}),'2026-12-10');
 assert.equal(f.validityBeforeException155({vigencia_hasta:'2027-03-01',vigencia_desde:'2026-11-01',vigencia_regla:{modo:'DIAS',dias:30,origen:'TITULAR',en:'2026-11-01T12:00:00.000Z'},vigencia_excepcion:exc}),'2026-12-01');
 assert.equal(f.validityBeforeException155({vigencia_hasta:'2027-03-01',vigencia_excepcion:exc}),null,'sin evidencia no se inventa una fecha');
});
