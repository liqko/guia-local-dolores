const text=v=>String(v??"").trim();
const norm=v=>text(v).toLowerCase();

function publicProfile(s){
  return {
    suscriptor_id:text(s.suscriptor_id||s.id),
    nombre:text(s.nombre),
    mail:text(s.mail),
    whatsapp:text(s.whatsapp),
    fecha_nacimiento:text(s.fecha_nacimiento),
    tipo_usuario:text(s.tipo_usuario),
    ciudad_origen_id:text(s.ciudad_origen_id),
    ciudad_origen_otro:text(s.ciudad_origen_otro),
    provincia_origen:text(s.provincia_origen),
    ciudad_predeterminada_id:text(s.ciudad_predeterminada_id),
    activo:s.activo,
    email_verificado:s.email_verificado
  };
}

export async function createSubscriberV3({db,body}){
  const mail=norm(body&&body.mail),clave=text(body&&body.clave),nombre=text(body&&body.nombre);
  if(!mail||!clave||!nombre)throw new Error("Faltan nombre, mail o clave.");
  if(clave.length<6)throw new Error("La contraseña debe tener al menos 6 caracteres.");

  const exists=await db.queryEqual("suscriptores","mail",mail,5);
  if(exists.some(x=>norm(x.mail)===mail))throw new Error("Ya existe una cuenta con ese mail.");

  const id="SUS-"+crypto.randomUUID().replace(/-/g,"").slice(0,18).toUpperCase();
  const now=new Date().toISOString();
  const doc={
    suscriptor_id:id,
    nombre,
    mail,
    clave,
    whatsapp:text(body.whatsapp),
    fecha_nacimiento:text(body.fecha_nacimiento),
    tipo_usuario:text(body.tipo_usuario||"RESIDENTE").toUpperCase(),
    ciudad_origen_id:text(body.ciudad_origen_id),
    ciudad_origen_otro:text(body.ciudad_origen_otro),
    provincia_origen:text(body.provincia_origen),
    ciudad_predeterminada_id:text(body.ciudad_predeterminada_id),
    activo:true,
    email_verificado:false,
    email_verificado_fecha:"",
    fecha_alta:now,
    creado_en:now,
    actualizado_en:now,
    ultimo_acceso:""
  };

  const saved=await db.patch("suscriptores",id,doc);
  return{success:true,message:"Suscriptor creado",suscriptor:publicProfile(saved)};
}
