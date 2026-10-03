/**
 * Presupuestos máximos de operación.
 * Sirven para revisión y tests; no son métricas decorativas.
 */
export const budgets={
  territoryPublic:{firestoreReads:0,firestoreWrites:0,kvReads:1},
  territoryAdminOpen:{firestoreReads:0,firestoreWrites:0,kvReads:1},
  territorySave:{firestoreGlobalReads:0,firestoreWrites:1,kvWrites:2},
  commercePanel:{firestoreReadsFixed:2,firestoreQueries:1},
  promosPanel:{firestoreReadsFixed:2,firestoreQueries:2},
  eventsPanel:{firestoreReadsFixed:2,firestoreQueries:2},
  actividadesPanel:{firestoreReadsFixed:1,firestoreQueries:"1 + cantidad_de_actividades"},
  publicidadPanel:{firestoreReadsFixed:1,firestoreQueries:1},
  efemeridesPanel:{firestoreReadsFixed:0,firestoreQueries:"según permisos, nunca colección completa"},
  farmaciasPanel:{firestoreReadsFixed:1,firestoreQueries:3}
};
