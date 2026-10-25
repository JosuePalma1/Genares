# GENARES PostgreSQL: bloqueos de puesta en marcha

- **Identidad institucional:** el backend disponible solo instala identidad local de desarrollo. Trabajos y trazabilidad exigen esa identidad; no existe en este repositorio un adaptador institucional verificado ni un mapeo aprobado de capacidades. No se abrieron los permisos para sortearlo.
- **Validacion de PostgreSQL:** la migracion `1760000015000` esta preparada, pero no se aplico. No se ejecutaron pruebas de integracion ni se inicio ninguna base. Para validarla se requiere un PostgreSQL temporal autorizado, distinto de los puertos prohibidos, y ejecutar alli las migraciones y pruebas de extremo a extremo.
- **Alcance del historial:** solo se incorporan hechos con evidencia persistida existente o capturada desde ahora. Cambios anteriores sin auditoria no se pueden reconstruir de forma fiable y el endpoint reporta cobertura parcial.
- **Procesos externos:** el alta de trabajos y la administracion institucional del tribunal conservan sus pantallas de consulta. Su escritura requiere el contrato y la autorizacion del sistema institucional responsable; GENARES no crea procesos paralelos.
