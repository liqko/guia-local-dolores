import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {createRequire} from 'node:module';const require=createRequire(import.meta.url),ts=require(process.env.GLD_TYPESCRIPT_LIB||'typescript');
const context=vm.createContext({window:{},URL,fetch:()=>{throw Error('Rendering must not make requests.');}});
vm.runInContext(fs.readFileSync('plataforma/imagenes-publicas.js','utf8'),context);const media=context.window.GLD_MEDIA;context.GLD_MEDIA=media;
const file='1wY7hule8GCqWGbXUNyIEGuLQ7zUVJQ8M',direct='https://lh3.googleusercontent.com/d/'+file;
for(const address of ['https://drive.google.com/file/d/'+file+'/view?usp=sharing','https://drive.google.com/open?id='+file,'https://drive.google.com/uc?export=view&id='+file,'https://drive.google.com/thumbnail?id='+file+'&sz=w1000'])assert.equal(media.imageUrl(address),direct);
for(const address of ['https://example.com/image.png','https://drive.google.com.evil.test/file/d/'+file+'/view',direct,'https://youtu.be/VIDEO_ID'])assert.equal(media.imageUrl(address),address);
assert.equal(media.imageUrl(null),'');assert.ok(!media.imageAttr('https://example.com/a.png?x="quoted"').includes('"'));
const html=fs.readFileSync('plataforma/anunciantes.html','utf8');let banner;
for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){const source=ts.createSourceFile('page.js',match[1],99,true,ts.ScriptKind.JS);function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='renderBanner')banner=node.getText(source);ts.forEachChild(node,visit);}visit(source);}
assert.ok(banner);vm.runInContext(banner,context);
let out=context.renderBanner({formato:'IMAGEN',media_items:[{url:'https://drive.google.com/file/d/'+file+'/view?usp=sharing'}],cta:'https://example.com/landing'},'A');assert.ok(out.includes('src="'+direct+'"'));assert.ok(out.includes('href="https://example.com/landing"'));
out=context.renderBanner({formato:'CARRUSEL',media_items:[{url:'https://drive.google.com/open?id='+file},{url:'https://example.com/second.jpg'}]},'B');assert.ok(out.includes(direct));assert.ok(out.includes('https://example.com/second.jpg'));
context.getYouTubeEmbedUrl=url=>url;out=context.renderBanner({formato:'SHORT',media_items:[{url:'https://youtu.be/VIDEO_ID'}]},'C');assert.ok(out.includes('https://youtu.be/VIDEO_ID'));assert.ok(!out.includes('googleusercontent'));
console.log('PASS: actual broken Drive URL normalized; direct/foreign URLs retained; image and carousel render direct addresses; CTA and short video preserved; no requests or storage mutations.');
