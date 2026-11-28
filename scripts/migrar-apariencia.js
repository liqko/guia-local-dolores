/* Conversión de declaraciones de color: conserva los valores originales en modo claro.
   Herramienta de migración, no se ejecuta en el navegador. */
function migrateAppearance(source, file) {
  const colorPattern=/#(?:[a-f0-9]{6}|[a-f0-9]{3})(?![a-f0-9])\b|\b(?:white|black)\b/gi;
  function rgb(value){let h=value.toLowerCase();if(h==='white')h='#fff';if(h==='black')h='#000';h=h.slice(1);if(h.length===3)h=[...h].map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));}
  function role(value,kind){
    const [r,g,b]=rgb(value),min=Math.min(r,g,b),max=Math.max(r,g,b),l=.2126*r+.7152*g+.0722*b;
    if(kind==='border')return min>=115&&l>=150?'border':null;
    if(kind==='background'){
      if(min<155||l<176)return null;
      if(max-min<18)return l>244?'surface':l>224?'bg':'soft';
      if(r>g+14&&r>b+10)return g>b+10?'warm-soft':'red-soft';
      if(b>r+9&&g>r+5)return 'blue-soft';
      if(g>r+6&&g>b-5)return 'green-soft';
      if(b>g+7)return 'purple-soft';
      return 'soft';
    }
    if(l>=175)return null;
    if(max-min<24)return l<95?'text':'muted';
    if(r>g*1.3&&r>b*1.25)return g>b*1.35?'warn':'danger';
    if(g>r*1.2&&g>b*1.12)return 'success';
    if(b>g*1.18&&r>g*1.05)return 'purple';
    if(b>r*1.1||g>r*1.1)return 'link';
    return l<105?'text':'muted';
  }
  function wrap(v,kind){return v.replace(colorPattern,m=>{const k=role(m,kind);return k?'var(--gld-theme-'+k+','+m+')':m;});}
  const keep=/\b(?:gld-brand|gldMarcaGlobal|nivel[-_ ]?\d|nivel[-_](?:black|badge|insignia)|level[-_](?:badge|chip|black)|black[-_](?:badge|chip)|insignia|logo|bandera|publicidad[-_](?:imagen|foto)|(?:badge|chip)[-_](?:vip|premium|black|nivel))\b/i;
  function declarations(s,selector=''){
    if(keep.test(selector))return s;
    const bg=s.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;{}]+)/i)?.[1]||'';
    const colors=[...bg.matchAll(colorPattern)].map(m=>m[0]);
    const fixedBackground=colors.some(v=>!role(v,'background'))||/url\s*\(|var\(\s*--(?:gld-)?(?:blue|azul|primary|coral|vip|danger)\b/i.test(bg);
    return s.replace(/(^|;)\s*((?:--[\w-]+|background(?:-color)?|color|border(?:-(?:top|right|bottom|left|block|inline))?(?:-color)?|outline(?:-color)?))\s*:\s*([^;{}]+)/gi,(all,sep,prop,value)=>{
      if(value.includes('var(--gld-theme-')||/url\s*\(|\\|\$\{/.test(value))return all;
      const name=prop.toLowerCase();let kind;
      if(name.startsWith('--')){
        if(/(?:border|line|borde)(?:-|$)/.test(name))kind='border';
        else if(/(?:text|muted|gris|ink)(?:-|$)/.test(name))kind='color';
        else if(/(?:bg|panel|surface|card|soft|suave|beige|arena|blanco)(?:-|$)/.test(name))kind='background';
        else return all;
      }else if(name.startsWith('background'))kind='background';
      else if(name==='color')kind='color';
      else kind='border';
      if(kind==='color'&&fixedBackground&&!name.startsWith('--'))return all;
      if(kind==='background'&&fixedBackground&&!name.startsWith('--'))return all;
      let next=wrap(value,kind);
      if(kind==='color'&&!name.startsWith('--'))next=next.replace(/var\((--(?:gld-)?(?:blue(?:-dark)?|azul(?:-osc)?|primary(?:-dark)?))\)/g,'var(--gld-theme-link,var($1))');
      return next===value?all:all.slice(0,all.length-value.length)+next;
    });
  }
  function css(s){return s.replace(/([^{}]+)\{([^{}]*)\}/g,(all,selector,body)=>selector+'{'+declarations(body,selector)+'}');}
  if(file.endsWith('.css'))return css(source);
  let out=source.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,(_,a,b,c)=>a+css(b)+c);
  // Estilos estáticos del documento y de plantillas HTML, sin tocar expresiones dinámicas.
  out=out.replace(/\bstyle=(["'])([^"'<>\r\n]*?)\1/g,(all,q,body,offset)=>{
    const left=out.slice(Math.max(0,offset-250),offset),start=left.lastIndexOf('<');
    if(start<0||left.lastIndexOf('>')>start||!/^[a-z][\w-]*(?:\s|$)/i.test(left.slice(start+1)))return all;
    return 'style='+q+declarations(body,left.slice(start+1))+q;
  });
  if(!/\/plataforma\/apariencia\.js/.test(out)){
    const tag='<script src="/plataforma/apariencia.js"></script>\n';
    if(/<head\b[^>]*>/i.test(out))out=out.replace(/<head\b[^>]*>/i,m=>m+'\n'+tag);
    else out=tag+out;
  }
  return out;
}
