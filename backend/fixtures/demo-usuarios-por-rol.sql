-- SOLO DESARROLLO · rama demo/accesos-por-rol · Usuarios de demostración por rol.
-- Ejecutar conectado como postgres a genares_integrado_dev, después de los scripts de
-- docs/s4/base-datos-dev y de s4-carga-volumen-dev.sql. Es idempotente.
--
-- Crea las cuentas (gen.usuario) de los usuarios de demostración que no existían. Su
-- sujeto_autenticacion debe coincidir con backend/src/common/api/identidad-demo.ts:
--   · Coordinación TI, Coordinación Software, Presidencia, Comisión TI, Secretaría y
--     Administración técnica y super.admin: personas ficticias nuevas.
--   · tribunal.carga: cuenta para «Ana Docente Carga TI A», tribunal de unos 40 trabajos CARGA.
--   · tribunal.ti (María) y tribunal.soft (Lucía) ya tienen cuenta desde 001_catalogos_y_personas_dev.sql.
-- También deja sus roles y carreras en gen.rol, gen.usuario_rol y gen.usuario_carrera, como referencia.
-- Los permisos efectivos de la demostración los decide identidad-demo.ts, no estas tablas.
-- No se usan contraseñas reales: la de la demostración es común y está en docs/s4/demo-usuarios.md.
BEGIN;

DO $$
BEGIN
  IF current_database() <> 'genares_integrado_dev' THEN
    RAISE EXCEPTION 'Base incorrecta: ejecuta este archivo en genares_integrado_dev';
  END IF;
  IF to_regprocedure('s4.uuid_fixture(text)') IS NULL THEN
    RAISE EXCEPTION 'Ejecuta antes los scripts de docs/s4/base-datos-dev';
  END IF;
END
$$;

INSERT INTO gen.persona (id, identificacion, nombres, apellidos)
SELECT s4.uuid_fixture('demo-persona-' || u.clave), 'DEMO-ID-' || upper(u.clave), u.nombres, u.apellidos
FROM (VALUES
  ('coordinacion-ti', 'Coordinación', 'TI (demo)'),
  ('coordinacion-soft', 'Coordinación', 'Software (demo)'),
  ('presidencia', 'Presidencia', 'Demo'),
  ('comision-ti', 'Comisión', 'TI (demo)'),
  ('secretaria', 'Secretaría', 'Demo'),
  ('admin-tecnico', 'Administración', 'Técnica (demo)'),
  ('super-admin', 'Superusuario', 'S4 (demo)')
) AS u(clave, nombres, apellidos)
ON CONFLICT (id) DO NOTHING;

INSERT INTO gen.usuario (id, email, activo, persona_id, sujeto_autenticacion)
SELECT s4.uuid_fixture('demo-usuario-' || u.clave), 'demo-' || u.clave || '@genares.invalid', true,
       s4.uuid_fixture('demo-persona-' || u.clave), 'demo-' || u.clave
FROM unnest(ARRAY['coordinacion-ti', 'coordinacion-soft', 'presidencia', 'comision-ti', 'secretaria', 'admin-tecnico', 'super-admin']) AS u(clave)
ON CONFLICT (id) DO NOTHING;

-- Cuenta de Ana (tribunal de los trabajos CARGA de TI) y vínculo con su ficha de docente.
INSERT INTO gen.usuario (id, email, activo, persona_id, sujeto_autenticacion)
SELECT s4.uuid_fixture('demo-usuario-tribunal-carga'), 'demo-tribunal-carga@genares.invalid', true,
       s4.uuid_fixture('carga-persona-doc-ti-a'), 'demo-tribunal-carga'
WHERE EXISTS (SELECT 1 FROM gen.persona WHERE id = s4.uuid_fixture('carga-persona-doc-ti-a'))
ON CONFLICT (id) DO NOTHING;
UPDATE gen.docente SET usuario_id = s4.uuid_fixture('demo-usuario-tribunal-carga')
WHERE id = s4.uuid_fixture('carga-doc-ti-a') AND usuario_id IS NULL
  AND EXISTS (SELECT 1 FROM gen.usuario WHERE id = s4.uuid_fixture('demo-usuario-tribunal-carga'));

-- Roles y carreras como referencia (los permisos de la demostración están en identidad-demo.ts).
INSERT INTO gen.rol (id, codigo, nombre, descripcion)
SELECT s4.uuid_fixture('demo-rol-' || r.clave), 'DEMO-' || upper(r.clave), r.nombre, 'Rol de demostración'
FROM (VALUES ('coordinacion', 'Coordinación (demo)'), ('presidencia', 'Presidencia / Asistencia (demo)'),
             ('comision', 'Comisión Académica (demo)'), ('secretaria', 'Secretaría (demo)'),
             ('administracion', 'Administración técnica (demo)'), ('superusuario', 'Superusuario S4 (demo)')) AS r(clave, nombre)
ON CONFLICT (id) DO NOTHING;

INSERT INTO gen.usuario_rol (id, usuario_id, rol_id)
SELECT s4.uuid_fixture('demo-ur-' || x.usuario), s4.uuid_fixture('demo-usuario-' || x.usuario), s4.uuid_fixture('demo-rol-' || x.rol)
FROM (VALUES ('coordinacion-ti', 'coordinacion'), ('coordinacion-soft', 'coordinacion'), ('presidencia', 'presidencia'),
             ('comision-ti', 'comision'), ('secretaria', 'secretaria'), ('admin-tecnico', 'administracion'),
             ('super-admin', 'superusuario')) AS x(usuario, rol)
ON CONFLICT (id) DO NOTHING;

INSERT INTO gen.usuario_carrera (id, usuario_id, carrera_id)
SELECT s4.uuid_fixture('demo-uc-' || x.usuario || '-' || x.carrera), s4.uuid_fixture('demo-usuario-' || x.usuario), s4.uuid_fixture(x.carrera)
FROM (VALUES ('coordinacion-ti', 'carrera-ti'), ('coordinacion-soft', 'carrera-soft'),
             ('presidencia', 'carrera-ti'), ('presidencia', 'carrera-soft'), ('comision-ti', 'carrera-ti'),
             ('secretaria', 'carrera-ti'), ('secretaria', 'carrera-soft')) AS x(usuario, carrera)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE 'Usuarios de demostración listos: % cuentas demo-* en gen.usuario; Ana vinculada: %.',
    (SELECT count(*) FROM gen.usuario WHERE sujeto_autenticacion LIKE 'demo-%'),
    (SELECT count(*) = 1 FROM gen.docente WHERE id = s4.uuid_fixture('carga-doc-ti-a') AND usuario_id IS NOT NULL);
END
$$;

COMMIT;
