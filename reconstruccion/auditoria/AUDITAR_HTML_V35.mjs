import fs from 'node:fs';
import vm from 'node:vm';
const files=['carcasa-territorio-v3.html','anunciantes-publico-v4.html','promos-public-v1.html','eventos-public-v1.html','actividades-public-v1.html','farma-turnos-public-v1.html','login-modular-v11.html','suscriptores-v3.html','granhermano-v2.html'];
let scripts=0;
for(const file of files){
 const html=fs.readFileSync('reconstruccion/plataforma/'+file,'utf8');
 if(/firebase(?:js|app|\.google)|firestore\.googleapis|firebase\/|onSnapshot\s*\(/i.test(html))throw new Error('Acceso Firebase directo en '+file);
 for(const [i,m]of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()){
  if(/\bsrc\s*=|application\/ld\+json|application\/json/i.test(m[1])||!m[2].trim())continue;
  new vm.Script(m[2],{filename:file+':script'+i});scripts++;
 }
}
console.log(`HTML V35 OK: ${files.length} interfaces vigentes, ${scripts} scripts, sin Firebase directo. La presentación y las rutas se prueban por separado en navegador.`);
