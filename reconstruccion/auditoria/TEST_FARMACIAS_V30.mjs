import {farmTurnosPublicV3} from "../worker/modules/farmacias-public-v3.js";

const packet={
  version:2,
  ciudad_id:"CITY-1",
  ciclos:[{
    ciclo_id:"FAR-1",
    ciudad_id:"CITY-1",
    fecha_inicio:"2026-10-01",
    hora_inicio:"08:00",
    duracion_horas:24,
    farmacias_por_turno:2,
    activo:true,
    participantes:[
      {ciclo_id:"FAR-1",sede_id:"S1",orden:1,activo:true},
      {ciclo_id:"FAR-1",sede_id:"S2",orden:2,activo:true},
      {ciclo_id:"FAR-1",sede_id:"S3",orden:3,activo:true}
    ],
    sedes:[
      {sede_id:"S1",nombre_sede:"Farmacia 1"},
      {sede_id:"S2",nombre_sede:"Farmacia 2"},
      {sede_id:"S3",nombre_sede:"Farmacia 3"}
    ]
  }]
};

const cache={
  async get(key){
    if(key==="farmacias:city:v2:CITY-1")return packet;
    return null;
  }
};

const d1=await farmTurnosPublicV3({cache,cityId:"CITY-1",fecha:"2026-10-01"});
if(!d1.success)throw new Error("No respondió success.");
if(d1.turnos.length!==2)throw new Error("Día 1 debe tener 2 farmacias.");
const n1=d1.turnos.map(x=>x.sede_id).sort().join(",");
if(n1!=="S1,S2")throw new Error("Rotación día 1 incorrecta: "+n1);

const d2=await farmTurnosPublicV3({cache,cityId:"CITY-1",fecha:"2026-10-02"});
if(d2.turnos.length!==4)throw new Error("Día 2 debe incluir el turno que termina a las 08:00 y el que comienza a las 08:00.");
const previo=d2.turnos.filter(x=>x.fecha_desde==="2026-10-01").map(x=>x.sede_id).sort().join(",");
const nuevo=d2.turnos.filter(x=>x.fecha_desde==="2026-10-02").map(x=>x.sede_id).sort().join(",");
if(previo!=="S1,S2")throw new Error("Cierre del turno anterior incorrecto: "+previo);
if(nuevo!=="S1,S3")throw new Error("Rotación del turno nuevo incorrecta: "+nuevo);

console.log("TEST FARMACIAS ROTACION OK");
