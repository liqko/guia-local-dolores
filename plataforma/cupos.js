(function(root){
function cupoGuardado(cupoAsignado){
  const n=Number(cupoAsignado);
  return Number.isSafeInteger(n)&&n>=0?n*2:0;
}
root.GLD_CUPOS={guardado:cupoGuardado};
})(globalThis);
