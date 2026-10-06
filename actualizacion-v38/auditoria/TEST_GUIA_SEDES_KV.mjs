import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
// Contrato de /guide: imágenes/contactos por sede y categorías como arrays.
const packet={id:'A',nombre:'Comercio',nivel:'5',categoria_ids:['C'],categorias:['Servicios'],img1:'',sedes:[
 {sede_id:'LOCAL',ciudad_id:'DOL (BUE - ARG)',img1:'https://example.org/local.jpg',mail:'local@example.org',instagram:'https://instagram.com/local'},
 {sede_id:'SEGUNDA',ciudad_id:'DOL (BUE - ARG)',img1:'https://example.org/segunda.jpg'}
]};
for(const name of ['anunciantes','carcasa']){
 const html=readFileSync(new URL('../../plataforma/'+name+'.html',import.meta.url),'utf8');
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
 scripts.forEach(s=>new vm.Script(s));
 const script=scripts.find(s=>s.includes('function hidratarItem(item)'));
 const source=script.slice(script.indexOf('function hidratarItem(item)'),script.indexOf('const anunciantesData = data.map(hidratarItem);'));
 const gallery=script.slice(script.indexOf('function renderGaleria('),script.indexOf('function renderContactoNuevo('));
 const individual=script.slice(script.indexOf('function tarjetaDeSede('),script.indexOf('function textoTags('));
 const context={limpiarCampos:item=>({...item}),metaPorIdGlobal:{},relacionesSedesGlobales:{},catalogosGlobales:{niveles:[]},relKey:v=>v,reglaNivel_:()=>({}),isInstagramPost:()=>false,isDirectImage:()=>true,setTimeout(){},fetch(){throw Error('No puede consultar red');}};
 vm.createContext(context);vm.runInContext(source+gallery+individual,context);
 const card=context.hidratarItem(packet);
 assert.equal(card.img1,'https://example.org/local.jpg');
 assert.equal(card.mail,'local@example.org');assert.equal(card.instagram,'https://instagram.com/local');
 assert.equal(card.categoria,'Servicios');assert.equal(packet.img1,'');
 assert.match(context.renderGaleria(card,5,'general'),/src="https:\/\/example.org\/local.jpg"/);
 const sedeCard=context.tarjetaDeSede(card,card.sedes[1]);
 assert.match(context.renderGaleria(sedeCard,5,'sede'),/src="https:\/\/example.org\/segunda.jpg"/);
 assert.equal(sedeCard.mail,''); // No heredar contactos de otra sede.
 const own=context.hidratarItem({...packet,img1:'https://example.org/propia.jpg',mail:'propio@example.org'});
 assert.equal(own.img1,'https://example.org/propia.jpg');assert.equal(own.mail,'propio@example.org');
 assert.equal(context.hidratarItem({img1:'https://example.org/sin-sede.jpg'}).img1,'https://example.org/sin-sede.jpg');
 assert.equal(context.renderGaleria(card,3,'sin-galeria'),'');
 console.log(name+': modelo KV → tarjeta general y tarjeta de sede conservan imágenes/contactos sin red, sin mezclar ciudades ni modificar el original.');
}
