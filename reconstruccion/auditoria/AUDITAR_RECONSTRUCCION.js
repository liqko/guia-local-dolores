#!/usr/bin/env node
/**
 * Guía Local reconstrucción — auditoría estática de arquitectura.
 * Falla si reaparecen patrones prohibidos dentro de /reconstruccion.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname,'..');
const rules = [
  {name:'territorio viejo desde UI', re:/api\(['"]territorios['"]\)/g},
  {name:'resumen_ciudad desde UI', re:/api\(['"]resumen_ciudad['"]/g},
  {name:'ubicaciones viejo', re:/action\s*[:=]\s*['"]ubicaciones['"]/g},
  {name:'polling', re:/setInterval\s*\(/g},
  {name:'commerce viejo para ciudades', re:/\/commerce[^\n]{0,120}ubicaciones/g},
];

function walk(dir){
  const out=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) out.push(...walk(p));
    else if(/\.(js|html|md)$/i.test(ent.name)) out.push(p);
  }
  return out;
}

let bad=0;
for(const file of walk(root)){
  if(file.includes(path.join('reconstruccion','auditoria','AUDITAR_RECONSTRUCCION.js'))) continue;
  const txt=fs.readFileSync(file,'utf8');
  for(const rule of rules){
    rule.re.lastIndex=0;
    const matches=[...txt.matchAll(rule.re)];
    if(matches.length){
      bad+=matches.length;
      for(const m of matches){
        const line=txt.slice(0,m.index).split('\n').length;
        console.error(`[PROHIBIDO] ${rule.name}: ${path.relative(root,file)}:${line}`);
      }
    }
  }
}
if(bad){
  console.error(`\nAuditoría fallida: ${bad} patrón(es) prohibido(s).`);
  process.exit(1);
}
console.log('Auditoría OK: no se detectaron patrones prohibidos.');
