import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

// Comprueba el grafo que realmente ejecuta V31, sin incluir prototipos archivados.
const root=path.resolve('reconstruccion/worker');
const entry=path.join(root,'app-main-v31.js');
const seen=new Set();
function visit(file){
  if(seen.has(file))return;
  if(!file.startsWith(root+path.sep))throw new Error('Import fuera del Worker: '+file);
  if(!fs.existsSync(file))throw new Error('Import faltante: '+file);
  seen.add(file);
  execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  const src=fs.readFileSync(file,'utf8');
  for(const match of src.matchAll(/(?:import|export)\s+(?:[^;]*?\s+from\s+)?["'](\.[^"']+)["']/g)){
    visit(path.resolve(path.dirname(file),match[1]));
  }
}
visit(entry);
await import(pathToFileURL(entry));
console.log(`IMPORTS V32 OK: ${seen.size} archivos del Worker V31, sintaxis e imports efectivos`);
