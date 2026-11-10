# Frontend de Genares

Interfaz React y Vite del subsistema S4. Las rutas, páginas, servicios y componentes activos están en `src/modules/s4-calificaciones`; el contexto y los estilos compartidos están en `src/shared`.

## Comandos

Desde la raíz del repositorio:

```powershell
npm --prefix .\frontend ci
npm --prefix .\frontend run dev
npm --prefix .\frontend run build
npm --prefix .\frontend test
```

El servidor de desarrollo escucha en `http://127.0.0.1:5173` y envía `/api` al backend local en `127.0.0.1:3001`. También puedes iniciar frontend y backend a la vez con `npm run dev` desde la raíz.
