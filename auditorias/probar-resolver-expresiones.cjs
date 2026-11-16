#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {resolveExpression:R}=require('./resolver-expresiones.cjs');
assert.deepEqual(R("'https://login.test'+'/superadmin/'+path",{path:'cities/create'}).values,['https://login.test/superadmin/cities/create']);
assert.deepEqual(R("cond ? '/a' : '/b'").values,['/a','/b']);
assert.deepEqual(R(String.fromCharCode(96)+'$'+'{origin}/superadmin/'+'$'+'{path}'+String.fromCharCode(96),{origin:'https://example.test',path:'cities/create'}).values,['https://example.test/superadmin/cities/create']);
assert.deepEqual(R("url",{},{url:"API+path",API:"'https://example.test/superadmin'",path:"'/cities/create'"}).values,['https://example.test/superadmin/cities/create']);
assert.deepEqual(R("encodeURIComponent(id)").values,[':id']);
assert.deepEqual(R("routes[action]",{action:'buscar'},{'routes.buscar':"'/subscribers/search'"}).values,['/subscribers/search']);
assert.deepEqual(R("new URL('/search', origin)",{origin:'https://example.test'}).values,['https://example.test/search']);
assert.equal(R('unknown').complete,false);
assert.equal(R('Math.random()').complete,false);
console.log('RESOLUCION SIMBOLICA PASS: URL, tabla, ternario, template, parametro, desconexiones no inventadas');
