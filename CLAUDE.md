# Genares · S4 — instrucciones para Claude Code

Responde siempre en **español**. Los nombres técnicos (tablas, funciones, comandos) se dejan tal cual.

## Reglas del proyecto

Las reglas completas de S4 están en los `AGENTS.md` de cada módulo. Claude Code los carga mediante el `CLAUDE.md` de esa misma carpeta:

- Backend: [backend/src/modules/s4-calificaciones/AGENTS.md](backend/src/modules/s4-calificaciones/AGENTS.md)
- Frontend: [frontend/src/modules/s4-calificaciones/AGENTS.md](frontend/src/modules/s4-calificaciones/AGENTS.md)

Ante cualquier conflicto, mandan esos archivos. Resumen de lo que más importa:

- **Alcance mínimo.** Haz exactamente lo que se pidió. Si una mejora adicional parece necesaria, propónla y pregunta antes de implementarla; no amplíes la tarea por tu cuenta.
- Solo se escribe en `*/src/modules/s4-calificaciones/`, `backend/fixtures/` y `docs/s4/`. No toques S1, S2 ni S3, ni los archivos compartidos (`common/`, `config/`, `shared/`, `package.json`, `main.ts`, `app.module.ts`) sin consultar.
- Sin Docker, sin migraciones ni `synchronize`. Los cambios de esquema van como SQL idempotente en `backend/fixtures/` y **los ejecuta el usuario en pgAdmin como `postgres`**. El backend se conecta como `genares`; no cambies el `.env` a `postgres`.
- Sin `commit`, `push`, PR ni `merge` salvo petición expresa.
- No digas que algo está probado sin haber ejecutado la prueba; indica qué se ejecutó y qué no.

## Retención y auditoría de S4

Las tablas de `s4` no se borran: `estado_registro` 1 = visible, 0 = oculto. El estado académico (`BORRADOR`, `CERRADA`, …) es un campo aparte. Cada cambio queda en `s4.eventos_cambio_registro`. Toda consulta operativa nueva debe filtrar `estado_registro = 1`, también en las estructuras hijas (etapa → categoría → indicador). Detalles: [docs/s4/decisiones/2026-11-10-retencion-visibilidad-auditoria.md](docs/s4/decisiones/2026-11-10-retencion-visibilidad-auditoria.md).

## Comandos (desde la raíz)

```powershell
npm run dev                          # backend + frontend
npm --prefix .\backend run build
npm --prefix .\backend test
npm --prefix .\frontend run build
npm --prefix .\frontend test
```

Más contexto en [README.md](README.md).
