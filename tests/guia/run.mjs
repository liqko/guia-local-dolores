import {mkdtempSync,mkdirSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const work=mkdtempSync(join(tmpdir(),'gld-guia-'));
mkdirSync(join(work,'circuits128'));
mkdirSync(join(work,'cierre-integral'));
mkdirSync(join(work,'revision-por-interfaz/usuario-guia'),{recursive:true});
const tests=['verify-config-collision-integrado.mjs','verify-owner-collision-integrado.mjs','verify-profile-sedes-collision-integrado.mjs','verify-whole-advertiser-save-integrado.mjs','verify-user-guide-integrado.mjs','panel-guardado.cjs'];
try{
  for(const name of tests){
    const result=spawnSync(process.execPath,[fileURLToPath(new URL(name,import.meta.url))],{cwd:work,encoding:'utf8'});
    if(result.status!==0){process.stderr.write((result.stdout+result.stderr).slice(-5000));process.exitCode=1;break;}
    console.log('PASS '+name);
  }
  if(!process.exitCode&&process.env.GLD_GUIDE_REPORT){
    writeFileSync(process.env.GLD_GUIDE_REPORT,readFileSync(join(work,'revision-por-interfaz/usuario-guia/resultados.json')));
  }
}finally{rmSync(work,{recursive:true,force:true});}
