'use strict';
// Evaluación abstracta de expresiones JavaScript, sin ejecutar código del proyecto.
// Conserva todas las alternativas explícitas y marca los valores desconocidos.
const ts=require('typescript');
const MAX=64;
function unique(a){return [...new Set(a)].slice(0,MAX);}
function result(values,complete=true,unknown=[]){return {values:unique(values),complete,unknown:unique(unknown)};}
function merge(a,b){return result([...a.values,...b.values],a.complete&&b.complete,[...a.unknown,...b.unknown]);}
function combine(a,b){const values=[];for(const x of a.values)for(const y of b.values){if(values.length>=MAX)break;values.push(x+y);}return result(values,a.complete&&b.complete&&a.values.length*b.values.length<=MAX,[...a.unknown,...b.unknown]);}
function resolveExpression(expression,ctx={},definitions={},trail=new Set(),level=0){
 const expr=String(expression||'').trim();if(!expr||level>20)return result([],false,['empty_or_depth']);
 const sf=ts.createSourceFile('expr.js','const __value = ('+expr+');',ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 if(sf.parseDiagnostics.length)return result([],false,['syntax']);
 const init=sf.statements[0]?.declarationList?.declarations[0]?.initializer;
 const lookup=(key)=>{
   if(key in ctx){const v=ctx[key];if(v&&typeof v==='object'&&Array.isArray(v.values))return v;return result(Array.isArray(v)?v.map(String):[String(v)]);}
   if(key in definitions&&!trail.has(key)){
     trail.add(key);const v=resolveExpression(definitions[key],ctx,definitions,trail,level+1);trail.delete(key);return v;
   }
   return result([],false,[key]);
 };
 const E=(n,depth=0)=>{
   if(!n||depth>25)return result([],false,['expression_depth']);
   if(ts.isParenthesizedExpression(n)||ts.isAsExpression?.(n)||ts.isNonNullExpression?.(n))return E(n.expression,depth+1);
   if(ts.isStringLiteralLike(n)||ts.isNoSubstitutionTemplateLiteral(n))return result([n.text]);
   if(ts.isNumericLiteral(n))return result([n.text]);
   if(n.kind===ts.SyntaxKind.TrueKeyword)return result(['true']);
   if(n.kind===ts.SyntaxKind.FalseKeyword)return result(['false']);
   if(ts.isIdentifier(n))return lookup(n.text);
   if(ts.isTemplateExpression(n)){
     let out=result([n.head.text]);
     for(const span of n.templateSpans)out=combine(combine(out,E(span.expression,depth+1)),result([span.literal.text]));
     return out;
   }
   if(ts.isBinaryExpression(n)){
     const op=n.operatorToken.kind;
     if(op===ts.SyntaxKind.PlusToken)return combine(E(n.left,depth+1),E(n.right,depth+1));
     if([ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(op))return merge(E(n.left,depth+1),E(n.right,depth+1));
     if(op===ts.SyntaxKind.EqualsToken||op===ts.SyntaxKind.PlusEqualsToken)return E(n.right,depth+1);
   }
   if(ts.isConditionalExpression(n))return merge(E(n.whenTrue,depth+1),E(n.whenFalse,depth+1));
   if(ts.isPropertyAccessExpression(n)){
     const base=n.expression.getText(sf),full=base+'.'+n.name.text;
     if(full in ctx)return lookup(full);
     if(full in definitions)return lookup(full);
     if(['href','pathname','origin','search'].includes(n.name.text)){
       const baseResult=E(n.expression,depth+1);
       const values=[];
       for(const v of baseResult.values){
         try{const u=new URL(v);
           values.push(n.name.text==='href'?u.href:n.name.text==='pathname'?u.pathname:n.name.text==='origin'?u.origin:u.search);
         }catch(_){if(n.name.text==='pathname'&&v.startsWith('/'))values.push(v);}
       }
       return result(values,baseResult.complete,[...baseResult.unknown]);
     }
     return result([],false,[full]);
   }
   if(ts.isElementAccessExpression(n)){
     const base=n.expression.getText(sf),keys=E(n.argumentExpression,depth+1),vals=[];
     let complete=keys.complete,unknown=[...keys.unknown];
     for(const key of keys.values){
       const q=lookup(base+'.'+key);vals.push(...q.values);complete&&=q.complete;unknown.push(...q.unknown);
     }
     return result(vals,complete,unknown);
   }
   if(ts.isNewExpression(n)&&n.expression.getText(sf)==='URL'){
     const [a,b]=n.arguments||[],v=E(a,depth+1),base=b?E(b,depth+1):result([]);
     if(!b)return v;
     const values=[];for(const x of v.values)for(const y of base.values)try{values.push(new URL(x,y).href);}catch(_){}
     return result(values,v.complete&&base.complete,[...v.unknown,...base.unknown]);
   }
   if(ts.isCallExpression(n)){
     const target=n.expression,text=target.getText(sf),fn=ts.isIdentifier(target)?target.text:ts.isPropertyAccessExpression(target)?target.name.text:'';
     const args=n.arguments||[];
     if(['String','decodeURIComponent'].includes(fn))return E(args[0],depth+1);
     if(fn==='encodeURIComponent'){
       const value=E(args[0],depth+1);
       if(value.values.length)return result(value.values.map(encodeURIComponent),value.complete,value.unknown);
       const ident=args[0]?.getText(sf).replace(/[^\w]/g,'').slice(0,40)||'value';
       return result([':'+ident],true,['parameter:'+ident]);
     }
     if(['toString','valueOf'].includes(fn)&&ts.isPropertyAccessExpression(target))return E(target.expression,depth+1);
     if(fn==='concat'&&ts.isPropertyAccessExpression(target)){
       let x=E(target.expression,depth+1);for(const a of args)x=combine(x,E(a,depth+1));return x;
     }
     if(['replace','trim','toLowerCase','toUpperCase'].includes(fn)&&ts.isPropertyAccessExpression(target)){
       const source=E(target.expression,depth+1);
       if(fn==='trim')return result(source.values.map(x=>x.trim()),source.complete,source.unknown);
       return result(source.values,false,[...source.unknown,'string_transform:'+fn]);
     }
     return result([],false,['call:'+text.slice(0,80)]);
   }
   if(ts.isPrefixUnaryExpression(n))return E(n.operand,depth+1);
   return result([],false,['unsupported:'+ts.SyntaxKind[n.kind]]);
 };
 return E(init);
}
module.exports={resolveExpression};
