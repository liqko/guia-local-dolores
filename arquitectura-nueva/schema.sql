-- Guía Local 2. Base aislada: exclusivamente GLD2_DB.
-- Todas las entidades comparten una estructura, independientemente de la interfaz.
CREATE TABLE IF NOT EXISTS gld2_entities(
 id TEXT PRIMARY KEY NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('guide','event','activity','promotion','advertising')),
 city TEXT NOT NULL,
 owner_id TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
 removed INTEGER NOT NULL DEFAULT 0 CHECK(removed IN (0,1)),
 public_json TEXT NOT NULL DEFAULT '{}',
 data_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS gld2_entities_city_kind ON gld2_entities(city,kind,published,removed,id);
CREATE INDEX IF NOT EXISTS gld2_entities_owner ON gld2_entities(owner_id,id);
CREATE TABLE IF NOT EXISTS gld2_roles(
 principal_id TEXT NOT NULL,role TEXT NOT NULL,active INTEGER NOT NULL CHECK(active IN (0,1)),
 PRIMARY KEY(principal_id,role));
CREATE TABLE IF NOT EXISTS gld2_grants(
 entity_id TEXT NOT NULL,principal_id TEXT NOT NULL,
 permission TEXT NOT NULL CHECK(permission IN ('READ','WRITE')),
 active INTEGER NOT NULL CHECK(active IN (0,1)),
 PRIMARY KEY(entity_id,principal_id,permission));
CREATE INDEX IF NOT EXISTS gld2_grants_principal ON gld2_grants(principal_id,active,entity_id);
CREATE TABLE IF NOT EXISTS gld2_revisions(
 city TEXT NOT NULL,kind TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(city,kind));
-- Política: todas las autorizaciones se evalúan contra DB y sesión verificada por GLD2_IDENTITY.
-- El usuario no puede asignarse el rol GRAN_HERMANO por esta API.
-- Aún faltan auditoría persistente, política de ediciones, imágenes y control de cupos.
