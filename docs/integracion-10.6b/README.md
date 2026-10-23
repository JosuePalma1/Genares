# Genares 10.6B — verificación de modelos y preparación de cronograma

Este paquete separa el esquema físico actual, una extensión propuesta para cronogramas versionados, y un modelo conceptual de integración. Es una entrega de documentación; no implementa cambios de software ni de base de datos.

## Archivos

- [Verificación del esquema](01-verificacion-esquema.md): alcance, fuentes, disponibilidad de PostgreSQL y matriz de discrepancias.
- [DER actual](02-der-actual.mmd): 29 tablas y claves foráneas declaradas por las migraciones del repositorio.
- [DER actual más propuesta](03-der-actual-mas-cronograma.mmd): esquema actual más nueve entidades futuras marcadas `PROP_`.
- [DER conceptual de integración](04-der-general-conceptual.mmd): fronteras de datos para Sistemas 1, 2, 3 y Genares.
- [Flujo de integración](05-flujo-integracion.mmd): flujo conceptual derivado de 10.6A; es un `flowchart`, no un DER.
- [Diccionario corregido](06-diccionario-corregido.md): nombres físicos, columnas relevantes y restricciones que no se ven en decoradores.
- [Decisiones de cronograma](07-decisiones-cronograma.md): compatibilidad con la programación legacy y propuesta de versionado, reservas y auditoría.
- [Matriz de integración](08-matriz-integracion.md): propietarios observados/candidatos, consumidores y preguntas de contrato.
- [Requisitos actualizados](09-requisitos-actualizados.md): distingue estado actual, regla confirmada, propuesta y pendiente institucional.
- [Resumen para compartir](10-resumen-para-compartir.md): síntesis ejecutiva.
- `diagramas/`: recortes por dominio para lectura y revisión.
- `paquete-entrega/`: copias depuradas de los diagramas y la síntesis para compartir.

## Cómo leer los modelos

El modelo A refleja el SQL de las diez migraciones fuente encontradas. No representa un catálogo vivo de PostgreSQL: el entorno desechable 9D estaba apagado, por lo que no se consultó ni se verificó su marcador. Los modelos B y C contienen elementos propuestos o conceptuales, claramente rotulados; no son tablas existentes ni autorizan crear migraciones.

Las flechas muestran relaciones físicas solo en el DER A. Las relaciones marcadas como propuestas o conceptuales expresan diseño sujeto a acuerdo institucional, no claves foráneas de los sistemas externos.

Los diagramas se entregan en Mermaid (`.mmd`). No se encontró un renderizador disponible en el entorno, por lo que no se afirma que se hayan generado o revisado imágenes SVG/PNG. Se revisó el texto y la estructura de los archivos.

## Límites

No se modificó React, NestJS, TypeORM, migraciones, PostgreSQL, documentos institucionales ni dependencias. No se ejecutaron pruebas ni build. La fuente `docs/integracion-10.6a/` se conserva intacta. No se crearon commits.
