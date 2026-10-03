import {getCommerceCatalogs} from "../core/catalogs.js";

export async function publicGuideCatalogsV2({cache}){
  const c=await getCommerceCatalogs(cache);
  const segmentos=Array.isArray(c.segmentos)?c.segmentos:[];
  return{
    success:true,
    segmentos,
    segmentos_publicos:segmentos,
    categorias:Array.isArray(c.categorias)?c.categorias:[],
    actividades_clave:Array.isArray(c.actividades_clave)?c.actividades_clave:[],
    acciones:Array.isArray(c.acciones)?c.acciones:[],
    nodos:Array.isArray(c.nodos)?c.nodos:[],
    niveles_anunciante:Array.isArray(c.niveles_anunciante)?c.niveles_anunciante:[],
    source:"kv"
  };
}
