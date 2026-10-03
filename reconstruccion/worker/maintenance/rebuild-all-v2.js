import {rebuildTerritory} from "../modules/territory.js";
import {rebuildCatalogs} from "../core/catalogs.js";
import {rebuildGuideAllV2} from "../core/guide-read-model-v2.js";
import {rebuildPromosAll} from "../core/promos-read-model.js";
import {rebuildEventsAllV2} from "../core/events-read-model-v2.js";
import {rebuildActivitiesAllV2} from "../core/activities-read-model-v2.js";
import {rebuildPublicityAllV2} from "../core/publicity-read-model-v2.js";
import {rebuildEfemeridesAllV3} from "../core/efemerides-read-model-v2.js";
import {rebuildFarmAll} from "../core/farmacias-read-model.js";
import {rebuildAdminIndexesV2} from "../core/admin-indexes-v2.js";

/**
 * Seed/rebuild integral de la capa intermedia.
 * Mantenimiento explícito únicamente: nunca se invoca desde tráfico normal.
 */
export async function rebuildAllReadModelsV2({env,request,db,cache}){
  const started=new Date().toISOString();

  // Territorio y catálogos son dependencias del resto.
  const territoryResponse=await rebuildTerritory({env,request,db,cache});
  const territory=await territoryResponse.clone().json().catch(()=>({success:false}));
  if(!territoryResponse.ok||territory.success!==true){
    throw new Error(territory.message||"No se pudo reconstruir Territorio.");
  }

  const catalogs=await rebuildCatalogs({db,cache});

  const [
    guide,
    promos,
    events,
    activities,
    publicity,
    efemerides,
    pharmacies,
    adminIndexes
  ]=await Promise.all([
    rebuildGuideAllV2({db,cache}),
    rebuildPromosAll({db,cache}),
    rebuildEventsAllV2({db,cache}),
    rebuildActivitiesAllV2({db,cache}),
    rebuildPublicityAllV2({db,cache}),
    rebuildEfemeridesAllV3({db,cache}),
    rebuildFarmAll({db,cache}),
    rebuildAdminIndexesV2({db,cache})
  ]);

  return{
    success:true,
    started_at:started,
    finished_at:new Date().toISOString(),
    territory,
    catalogs,
    guide,
    promos,
    events,
    activities,
    publicity,
    efemerides,
    pharmacies,
    adminIndexes
  };
}
