import {readdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const directory=new URL('../../worker/',import.meta.url);
const files=(await readdir(directory)).filter(name=>name.endsWith('.txt'));
assert.equal(files.length,1,'Las pruebas deben utilizar el único Worker vigente');
export const workerURL=new URL(files[0],directory);
export const source=await readFile(workerURL,'utf8');
