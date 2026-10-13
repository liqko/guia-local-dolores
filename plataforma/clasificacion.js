(function(root){
function gldClassificationV86(){
  const text=v=>String(v??'').trim();
  const ids=row=>[row?.nivel_id,row?.numero,row?.id].filter(v=>text(v)!=='').map(text);
  const flag=v=>v===undefined||v===null||text(v)===''?null:v===true||v===1||['true','1','si','sí','x','activo','activa'].includes(text(v).toLowerCase());
  const levelNumber=row=>{for(const v of [row?.numero,row?.nivel_id,row?.id])if(text(v)!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0)return Number(v);return null;};
  const findLevel=(rows,value)=>{const v=text(value);if(!v)return {};return (rows||[]).find(row=>text(row?.nivel_id)===v||text(row?.id)===v)||(rows||[]).find(row=>text(row?.numero)===v)||{};};
  const name=row=>text(row?.titulo||row?.nombre||row?.label);
  const limit=(value,fallback)=>value===null||value===undefined||text(value)===''?fallback:Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):0;
  const rules=(row={},value)=>{const n=levelNumber(row)??levelNumber({id:value});return {
    descripcion_max:limit(row.descripcion_max,500),adicionales_max:limit(row.adicionales_max,150),
    tags_max:flag(row.tags_habilitados)===false?0:limit(row.tags_max,300),
    imagenes_max:flag(row.imagenes_habilitadas)===false?0:Math.min(5,limit(row.imagenes_max,n===3?0:n===1||n===2?3:5))
  };};
  return {text,ids,flag,levelNumber,name,findLevel,rules,active:row=>flag(row?.activo??row?.activa)!==false,levelLabel:row=>{const n=levelNumber(row),label=name(row);return (n===null?'Nivel sin número':'Nivel '+n)+(label?' · '+label:'');}};
}
root.GLD_CLASSIFICATION=gldClassificationV86();
})(globalThis);
