#!/usr/bin/env node
'use strict';
// Control automático seguro: sólo archivos del repositorio y datos simulados.
// No hay credenciales, despliegues ni llamadas a la plataforma real.
const {spawnSync} = require('node:child_process');
const {existsSync,mkdirSync,writeFileSync} = require('node:fs');
const {join} = require('node:path');
const groups = {
  usuario: [
    ['Integridad de pantallas','node',['tests/publication-integrity.mjs']],
    ['Guía pública y catálogo','node',['--test','tests/public-territory.test.mjs','tests/paquete-ciudad.test.mjs','tests/eventos-paquete.test.cjs']],
  ],
  anunciante: [
    ['Formularios, permisos y guardados','node',['--test','tests/anunciante-formularios/contratos-compartidos.test.mjs']],
    ['Copia privada y operaciones','node',['tests/guia/copia-persistente209.mjs']],
    ['Acceso por roles y niveles','node',['tests/guia/verify-panel-roles.mjs']],
  ],
  administrador: [
    ['Controles de acceso y revocaciones','node',['--test','tests/observabilidad/acceso-unificado201.test.mjs']],
    ['Reglas de publicación','node',['--test','tests/publicacion-reglas206.test.cjs']],
  ],
  navegador: [
    ['Ingreso y reclamo desde Anunciante en navegador aislado','node',['tests/browser/reclamo-directo.cjs']],
    ['Carga, recarga y actualización de Guía en navegador aislado','node',['tests/browser/paquete-ciudad.cjs']],
  ],
  compartido: [
    ['Integridad de los paquetes','node',['--test','tests/publicacion-generica.test.mjs','tests/recursos-publicos.test.mjs']],
    ['Cache de navegador pública','node',['tests/guia/public-cache.cjs']],
  ],
};
const group = process.argv[2];
if (!groups[group]) {console.error('Grupo inválido. Usar: '+Object.keys(groups).join(', '));process.exit(2);}
const results=[];
for(const [title,executable,args] of groups[group]){
  if(args.some(s=>s.startsWith('tests/')&&!existsSync(s))) {
    results.push({title,status:'ERROR',error:'Archivo de prueba ausente'});continue;
  }
  const began=Date.now();
  const p=spawnSync(executable,args,{encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024,env:{...process.env,GLD_WORKER_SOURCE:join(process.cwd(),'worker/worker206.txt')}});
  const ok=p.status===0&&!p.error;
  results.push({title,status:ok?'OK':'ERROR',duration_ms:Date.now()-began,exit_code:p.status,error:p.error?.message||null,output:(p.stdout||'').slice(-3500),stderr:(p.stderr||'').slice(-2500)});
  console.log((ok?'OK: ':'FALLÓ: ')+title);
}
mkdirSync('test-results',{recursive:true});
const report={group,passed:results.filter(r=>r.status==='OK').length,total:results.length,results};
writeFileSync('test-results/control-'+group+'.json',JSON.stringify(report,null,2)+'\n');
console.log('RESULTADO '+group+': '+report.passed+'/'+report.total);
if(report.passed!==report.total) {
  for (const r of results.filter(r=>r.status!=='OK')) console.error(r.title+'\n'+(r.error||'')+'\n'+r.output+'\n'+r.stderr);
  process.exitCode=1;
}
