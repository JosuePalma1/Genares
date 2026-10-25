# Frontend GENARES

Aplicación React para el flujo de trabajos de titulación. Usa datos locales para la demostración y puede consumir la API NestJS durante el desarrollo.

## Comandos

Desde la raíz:

```powershell
npm --prefix .\frontend run dev
npm --prefix .\frontend run test
npm --prefix .\frontend run build
```

El proxy de desarrollo apunta a `http://127.0.0.1:3001`. No se necesita un archivo `.env` propio del frontend.

La API se habilita desde la configuración del backend y conserva sus controles de acceso; el frontend no envía credenciales ni identidades simuladas.
