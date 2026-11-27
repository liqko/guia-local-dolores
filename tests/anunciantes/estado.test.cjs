/* Unidades 2 y 7: estado público, vencimiento del nivel 3 y visibilidad de la tarjeta. Funciones del Worker único. */
const fs=require('fs'),assert=require('node:assert/strict'),test=require('node:test');
const src=fs.readFileSync(__dirname+'/../../worker/worker206.txt','utf8');
const i=src.indexOf('// Unidades 2 y 7: estado público del anunciante.'),j=src.indexOf('// Todo anunciante nuevo recibe el nivel 3');
assert.ok(i>0&&j>i);
const f=new Function(src.slice(i,j)+'\nreturn {advertiserPublicState155,guideCardVisible155,initialValidity155,addDays155,argentinaDay155};')();
const at=Date.parse('2026-11-27T15:00:00Z');
test('motivos diferenciados y prioridad del bloqueo administrativo',()=>{
 assert.equal(f.advertiserPublicState155({aprobado:false,inactivo_motivo:'VOLUNTARIA'},undefined,undefined,at).motivo,'BLOQUEO_ADMINISTRATIVO');
 assert.equal(f.advertiserPublicState155({inactivo_motivo:'ADMINISTRATIVA'},undefined,undefined,at).motivo,'BLOQUEO_ADMINISTRATIVO');
 assert.equal(f.advertiserPublicState155({inactivo_motivo:'VOLUNTARIA'},undefined,undefined,at).motivo,'DESACTIVACION_VOLUNTARIA');
 assert.equal(f.advertiserPublicState155({nivel:'3',vigencia_hasta:'2026-11-26'},undefined,undefined,at).motivo,'VENCIDO');
 assert.equal(f.advertiserPublicState155({nivel:'3'},{nombre:'X'},[],at).motivo,'FICHA_INCOMPLETA');
 assert.equal(f.advertiserPublicState155({nivel:'3',vigencia_hasta:'2026-11-27'},{nombre:'X'},[{ciudad_id:'D'}],at).visible,true);
 assert.equal(f.advertiserPublicState155(null,undefined,undefined,at).visible,true,'legado sin administración sigue visible');
});
test('el vencimiento sólo aplica a niveles con renovación (nivel 3: 30 días)',()=>{
 assert.equal(f.advertiserPublicState155({nivel:'5',vigencia_hasta:'2020-01-01'},undefined,undefined,at).visible,true);
 assert.deepEqual(f.initialValidity155('3','2026-11-27T15:00:00Z'),{vigencia_desde:'2026-11-27',vigencia_hasta:'2026-12-27'});
 assert.deepEqual(f.initialValidity155('5','2026-11-27T15:00:00Z'),{});
 assert.equal(f.argentinaDay155(Date.parse('2026-11-28T02:00:00Z')),'2026-11-27','día de Argentina');
});
test('la tarjeta publicada deja de ser visible al vencer sin necesidad de reescribirla',()=>{
 assert.equal(f.guideCardVisible155({aprobado:true,vigencia_hasta:'2026-11-27'},at),true);
 assert.equal(f.guideCardVisible155({aprobado:true,vigencia_hasta:'2026-11-26'},at),false);
 assert.equal(f.guideCardVisible155({aprobado:false},at),false);assert.equal(f.guideCardVisible155({},at),true);
});
