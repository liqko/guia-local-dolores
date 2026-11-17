# Comprobación de Anunciante, Gran Hermano y Worker

17/11/2026. Oficial: 19933a0e56e5c1e55ade4a3c3fc4e327d5f96e0a. Generador: 7ce9ea4bd51e2ca5a1286007c4f754a5514da2a9.

**Resultado: integridad no acreditada; hay recorridos truncados y entradas de ejecución sin representación.**

| Componente | Fuente de auditoría igual a oficial | Árboles del HTML oficial | Entradas omitidas detectadas | Árboles truncados |
|---|---|---:|---:|---:|
| plataforma/login.html | Sí | 165 | 0 | 34 |
| plataforma/administracion.html | No | 166 | 4 | 51 |
| Worker | Sí | No es interfaz; se contrasta el servicio | 3 fronteras sin cuerpo en los árboles | Ver recorridos de interfaces |

## Comparación de fuentes

- plataforma/login.html: oficial 492df5e3ce257dde27dcbcd21452a95719d79eb8; auditoría 492df5e3ce257dde27dcbcd21452a95719d79eb8.
- plataforma/administracion.html: oficial 34350e2840285e57149de09cbc75a5af00b7b94e; auditoría 57d25b12e2f518842accc1523f4abd48f582ce44.
- worker/worker206.txt: oficial 788a9cb79d536459fd01050a449cd85db4daaf54; auditoría 788a9cb79d536459fd01050a449cd85db4daaf54.

## Entradas de Gran Hermano omitidas

- plataforma/administracion.html:740: `x.onchange=refresh`.
- plataforma/administracion.html:3955: `document.getElementById('btnLogin').onclick=login`.
- plataforma/administracion.html:3956: `document.getElementById('btnBuscarSus').onclick=buscarSus`.
- plataforma/administracion.html:3957: `document.getElementById('btnBuscarAnu').onclick=buscarAnu`.

## Fronteras del Worker

- worker/worker206.txt:11964: GldPublicCache119.fetch; cuerpo representado: no; raíz representada: no.
- worker/worker206.txt:12799: GldPublicCache119.prototype.alarm; cuerpo representado: no; raíz representada: no.
- worker/worker206.txt:13177: app_main_v35_default.fetch; cuerpo representado: no; raíz representada: no.

El enlace de una petición HTTP a una función interna no representa por sí solo el manejador exterior con sus envolturas, ni la recepción del actor ni la recuperación por alarma.

## Árboles truncados

### plataforma/login.html

- plataforma/login.html:1314; 7a4c053c35c2dc4c; pubDesdeContenido147('EVENTO',editingEventId||lastCreatedEventId); 62 marcadores de corte.
- plataforma/login.html:1721; b12fa0e520664980; pubDesdeContenido147('ACTIVIDAD',document.getElementById('act-id').value); 62 marcadores de corte.
- plataforma/login.html:1778; 6bf12c6a3719d215; pubTagsPerfil147(); 2 marcadores de corte.
- plataforma/login.html:4046; 3faaaedaecc3ea3c; pubDesdeContenido147('ACTIVIDAD',this.dataset.id); 62 marcadores de corte.
- plataforma/login.html:7494; d88245a530b8520e; pubDesdeContenido147('EVENTO',this.dataset.id); 62 marcadores de corte.
- plataforma/login.html:7532; 430a377e9a29a026; pubDesdeContenido147('EVENTO',this.dataset.id); 62 marcadores de corte.
- plataforma/login.html:2105; b3ec2dffffb23fef; callback@2105; 6 marcadores de corte.
- plataforma/login.html:4057; 06b3be713c9044c9; callback@4057; 3 marcadores de corte.
- plataforma/login.html:4263; e02b8a3df676c790; callback@4263; 93 marcadores de corte.
- plataforma/login.html:5000; b240c2c70df49932; callback@5000; 218 marcadores de corte.
- plataforma/login.html:5133; 7be990decc19b294; pubUiDestination_; 89 marcadores de corte.
- plataforma/login.html:5164; c32da02d8979516b; pubUiReset_; 134 marcadores de corte.
- plataforma/login.html:5551; 0f1f7cff0cd39ceb; callback@5551; 61 marcadores de corte.
- plataforma/login.html:6767; 99c50e7c64665323; callback@6767; 5 marcadores de corte.
- plataforma/login.html:7617; e9fade2e41bdbe06; callback@7617; 7 marcadores de corte.
- plataforma/login.html:8145; 55ba45af701f3ccf; callback@8145; 2 marcadores de corte.
- plataforma/login.html:8305; a87d99982d35a826; callback@8305; 21 marcadores de corte.
- plataforma/login.html:8511; 085480a575a80ca2; callback@8511; 5 marcadores de corte.
- plataforma/login.html:8663; e58725e2e53677cb; restaurarSesionSuscriptor_; 20 marcadores de corte.
- plataforma/login.html:8715; 413646b0cb261526; callback@8715; 94 marcadores de corte.
- plataforma/login.html:8810; e4523943d191e06e; callback@8810; 19 marcadores de corte.
- plataforma/login.html:8825; 5525f1287e2eaeb0; callback@8825; 19 marcadores de corte.
- plataforma/login.html:8858; 80e00b7dcb73c960; callback@8858; 19 marcadores de corte.
- plataforma/login.html:8892; b3792921bbb712ff; callback@8892; 93 marcadores de corte.
- plataforma/login.html:8898; d85ffa20e5cabe28; callback@8898; 3 marcadores de corte.
- plataforma/login.html:8975; e410afafc29787ee; callback@8975; 94 marcadores de corte.
- plataforma/login.html:9075; f535fd4fa3ffcfeb; callback@9075; 93 marcadores de corte.
- plataforma/login.html:9090; 672426057b199051; callback@9090; 2 marcadores de corte.
- plataforma/login.html:9143; d169d8176cc3cae3; callback@9143; 93 marcadores de corte.
- plataforma/login.html:9147; 02a3ed8391abedd4; cancelEventEdit; 5 marcadores de corte.
- plataforma/login.html:9149; 87290d8c85b2c976; callback@9149; 4 marcadores de corte.
- plataforma/login.html:9408; 568b355d93827c9a; callback@9408; 18 marcadores de corte.
- plataforma/login.html:9509; a91d3fe7659d1d9b; enviarSolicitudAnunciante_; 20 marcadores de corte.
- plataforma/login.html:9510; c43e28ebc0ee0018; callback@9510; 21 marcadores de corte.

### plataforma/administracion.html

- plataforma/administracion.html:217; 3b71e883f8f0d8a5; ghGoPending('SOLICITUD'); 10 marcadores de corte.
- plataforma/administracion.html:218; df97691e3be5b54a; ghGoView('soporte'); 9 marcadores de corte.
- plataforma/administracion.html:220; 37b128246d6a56e7; ghGoView('recientes'); 9 marcadores de corte.
- plataforma/administracion.html:238; f0404d7a1c5faa40; ghGoView('inicio'); 9 marcadores de corte.
- plataforma/administracion.html:238; 9bbb8665cf573565; ghPublicacionesV77(); 25 marcadores de corte.
- plataforma/administracion.html:240; 18033b127363b320; ghGoPending('EVENTO'); 10 marcadores de corte.
- plataforma/administracion.html:242; c6a3f83c1e1f020e; ghGoView('ventas'); 9 marcadores de corte.
- plataforma/administracion.html:242; 6f914bea5abf9340; ghPublicidadPrepare101(); 3 marcadores de corte.
- plataforma/administracion.html:254; a7c9f951a3eb7b26; ghRolesBuscar188(); 7 marcadores de corte.
- plataforma/administracion.html:291; dd3cbda2ba97dd55; ghComercialGuardar186(); 4 marcadores de corte.
- plataforma/administracion.html:291; 838602ed7f3140f2; ghRolesEliminarComercial190(); 5 marcadores de corte.
- plataforma/administracion.html:312; b785d77d04f7afba; ghRolesSeleccionarListado190(); 3 marcadores de corte.
- plataforma/administracion.html:335; 638852f85c495a6c; ghCotizarBuscarAnunciante171(); 7 marcadores de corte.
- plataforma/administracion.html:368; e0a3503da293d0ae; ghGuardarTodosPrecios162(); 10 marcadores de corte.
- plataforma/administracion.html:427; fdb75e13165ce362; ghCargarNodos(); 6 marcadores de corte.
- plataforma/administracion.html:435; da55af5bf27a4ef5; ghGuardarPublicacionNiveles_(); 6 marcadores de corte.
- plataforma/administracion.html:449; 029be50285e4b561; ghSelectConfig('resumen_planes'); 8 marcadores de corte.
- plataforma/administracion.html:982; 1d9bd2566bdd5d02; ghGuardarModerador(); 8 marcadores de corte.
- plataforma/administracion.html:982; 9e37b9a429a41113; ghRolesEliminarModerador190(); 9 marcadores de corte.
- plataforma/administracion.html:1238; 25ef5e334ccf0096; resolverPendiente(\''+esc(x.tipo||'EVENTO')+'\',\''+esc(id)+'\',\'APROBAR\'); 33 marcadores de corte.
- plataforma/administracion.html:1238; 1cee12c3ecf4f69e; resolverPendiente(\''+esc(x.tipo||'EVENTO')+'\',\''+esc(id)+'\',\'RECHAZAR\'); 33 marcadores de corte.
- plataforma/administracion.html:1262; 472cbbbf6e9e2690; resolverPendiente(\'ANUNCIANTE\',\''+esc(x.id||'')+'\',\'APROBAR\'); 33 marcadores de corte.
- plataforma/administracion.html:1262; cdb77a91fa865755; resolverPendiente(\'ANUNCIANTE\',\''+esc(x.id||'')+'\',\'RECHAZAR\'); 33 marcadores de corte.
- plataforma/administracion.html:2046; 2c1c40f6838be515; guardarAnuncianteComercial(); 6 marcadores de corte.
- plataforma/administracion.html:2153; da1106e2865afa8d; ghGuardarAmbitoCampos(); 8 marcadores de corte.
- plataforma/administracion.html:2189; 5fac6cd005f6b570; ghGuardarInfoAnuncianteCupos_(); 8 marcadores de corte.
- plataforma/administracion.html:2764; 153f919b66445cc4; ghGuardarFunciones166(); 12 marcadores de corte.
- plataforma/administracion.html:2900; e267e717a3907e17; ghGuardarCategoriasActividades(); 6 marcadores de corte.
- plataforma/administracion.html:2904; 8fab0e10dda54f06; ghGuardarCatalogo(\'prestaciones\',\''+esc(id)+'\'); 5 marcadores de corte.
- plataforma/administracion.html:2905; e03be678b54ae7b3; ghNuevaPrestacion_(); 5 marcadores de corte.
- plataforma/administracion.html:2909; 227a2457010c1b63; ghGuardarCatalogo(\''+def.tipo+'\',\''+esc(id)+'\'); 5 marcadores de corte.
- plataforma/administracion.html:2915; 8a85b32da65a4dcf; ghGuardarCatalogo(\'niveles_anunciante\',\''+esc(id)+'\'); 5 marcadores de corte.
- plataforma/administracion.html:2915; 38631ea124fb1f63; ghEliminarNivel(\''+esc(id)+'\'); 7 marcadores de corte.
- plataforma/administracion.html:3124; 1712bff086f2d542; ghGuardarCatalogo(\''+tipo+'\',\''+esc(id)+'\'); 5 marcadores de corte.
- plataforma/administracion.html:3166; 34517c305861c04c; ghGuardarNodo(\''+esc(id)+'\'); 7 marcadores de corte.
- plataforma/administracion.html:4005; b8bb812b26cbb404; ghRetirarPublicacionV77(\''+esc(x.collection)+'\',\''+esc(x.id)+'\'); 24 marcadores de corte.
- plataforma/administracion.html:4040; 26fef64f43fa6a07; ghResolverRevisionUnificada(\''+source+'\',\''+esc(tipo)+'\',\''+esc(id)+'\',\''+decision+'\'); 19 marcadores de corte.
- plataforma/administracion.html:4054; 4cb77e0578dab313; ghGoPending(\''+key+'\'); 10 marcadores de corte.
- plataforma/administracion.html:211; 7112006d36197e4a; ghGoView(...); 9 marcadores de corte.
- plataforma/administracion.html:617; f14203731b7a64d3; callback@617; 10 marcadores de corte.
- plataforma/administracion.html:753; b380289b0761409d; callback@753; 3 marcadores de corte.
- plataforma/administracion.html:945; 8c19d9d6f6b53149; callback@945; 10 marcadores de corte.
- plataforma/administracion.html:1019; 673eb83f59e4b368; callback@1019; 6 marcadores de corte.
- plataforma/administracion.html:1021; 0b60b2c3743101c6; callback@1021; 5 marcadores de corte.
- plataforma/administracion.html:1602; 69be92fa76f8a9d2; callback@1602; 6 marcadores de corte.
- plataforma/administracion.html:1635; 5b5bb9cd759245ba; callback@1635; 7 marcadores de corte.
- plataforma/administracion.html:3200; 43fd8bdba7863780; callback@3200; 9 marcadores de corte.
- plataforma/administracion.html:3929; f9e634b5c0370d79; callback@3929; 7 marcadores de corte.
- plataforma/administracion.html:3959; 8db541c6833960a4; callback@3959; 8 marcadores de corte.
- plataforma/administracion.html:3960; 9a77118a9d446fc6; buscarAnu; 7 marcadores de corte.
- plataforma/administracion.html:3970; de4c115f530d9bac; callback@3970; 6 marcadores de corte.

## Alcance y límites

Dos HTML principales y Worker oficial completos, mediante el generador vigente. Los cuerpos de scripts externos se rastrean cuando los árboles los alcanzan; este contraste no certifica todas las entradas de esos scripts.

- Resultado estático: no prueba fallo funcional ni mide consumos.
- Entradas HTML contrastadas por archivo y línea, no por ejecución en navegador. Las entradas no omitidas no acreditan todas las ramas.
- El Worker tiene 3 fronteras de ejecución contrastadas: fetch exterior, fetch de Durable Object y alarma. No se certifica cada decisión, actor interno o desencadenante adicional.
- Sitios de datos y puertas de ruta sin nodo son inventario para seguimiento, no prueba de código muerto ni conteo de operaciones ejecutadas.
- La igualdad de fuente de Worker en GitHub no demuestra igualdad con el Worker instalado en Cloudflare.

## Comprobación reproducible

Se usó el mismo generador vigente en dos checkouts separados. Sus regresiones pasaron. El control independiente existente se amplió con --restantes; no se creó otro generador ni se modificó producto.

`node auditorias/comprobar-integridad-usuario.cjs --restantes DIRECTORIO_OFICIAL DIRECTORIO_GENERADOR`

Siguiente acción: integrar estas evidencias en el generador único, cubrir asignaciones de eventos por referencia a función, quitar truncamientos y enlazar fronteras/actores/alarma antes de acreditar integridad.
