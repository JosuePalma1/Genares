-- Fixture manual para la base local de desarrollo; nunca se carga al iniciar la aplicación.
-- Solo usa datos ficticios y se puede ejecutar más de una vez.

INSERT INTO modalidades (codigo, nombre, esta_activo)
VALUES ('DEV_PROYECTO_INTEGRADOR', 'Proyecto integrador (desarrollo)', TRUE)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO periodos_academicos (codigo, fecha_inicio, fecha_fin, esta_activo)
VALUES ('DEV-2026-8E', DATE '2026-01-01', DATE '2026-12-31', TRUE)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rubricas (id_modalidad, nombre, descripcion)
SELECT modalidad.id, 'Rúbrica local de desarrollo', 'Fixture ficticio para validar la integración API de Rúbricas.'
FROM modalidades modalidad
WHERE modalidad.codigo = 'DEV_PROYECTO_INTEGRADOR'
ON CONFLICT (id_modalidad) DO NOTHING;
