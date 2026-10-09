/* Shared interpretation of catalog records. Does not change stored identifiers. */
(function(root){
  const text=v=>String(v??'').trim();
  const ids=row=>[row?.nivel_id,row?.numero,row?.id].filter(v=>v!==undefined&&v!==null&&text(v)!=='').map(text);
  const levelNumber=row=>{for(const v of [row?.numero,row?.nivel_id,row?.id])if(text(v)!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0)return Number(v);return null;};
  const name=row=>text(row?.titulo||row?.nombre||row?.label);
  const active=row=>{const v=row?.activo??row?.activa;if(v===undefined||v===null||v==='')return true;return v===true||v===1||['true','1','si','sí','x','activo','activa'].includes(text(v).toLowerCase());};
  root.GLD_CLASSIFICATION={ids,levelNumber,name,active,findLevel:(rows,value)=>(rows||[]).find(row=>ids(row).includes(text(value)))||{},levelLabel:row=>{const n=levelNumber(row);return (n===null?'Nivel sin número':'Nivel '+n)+(name(row)?' · '+name(row):'');}};
})(globalThis);
