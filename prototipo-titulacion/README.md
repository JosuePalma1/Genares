# Prototipo Genares

## Lectura local de r?bricas desde PostgreSQL

El funcionamiento predeterminado de las pantallas sigue siendo el prototipo y `localStorage`. Para consultar r?bricas PostgreSQL en desarrollo, prepara primero el backend local seg?n su README y habilita all? el perfil fijo `lector`. Luego copia `.env.development.example` a `.env.development.local` y configura:

```dotenv
VITE_RUBRICAS_SOURCE=api
VITE_API_BASE_URL=/api/v1
VITE_API_PROXY_TARGET=http://127.0.0.1:3001
```

El proxy de Vite apunta a loopback, escucha en `127.0.0.1` y deniega solicitudes desde otras direcciones aunque se fuerce otro host al iniciar Vite. El modo API solo funciona en desarrollo; las compilaciones de producci?n fuerzan el prototipo. No se habilita CORS ni se env?an cookies, tokens o identidades desde React.

### Origen y permisos

Las escrituras usan opt-ins independientes: `VITE_RUBRICAS_WRITE_API` para rubricas y `VITE_MODALIDADES_WRITE_API` para modalidades. Ambos permanecen desactivados por defecto. El opt-in de modalidades solo muestra sus acciones en desarrollo; NestJS valida la capacidad y la proteccion local de origen antes de aceptar cambios.

Con `VITE_RUBRICAS_SOURCE=api`, el listado y el detalle muestran exclusivamente la respuesta API. La pantalla indica el origen y muestra carga o error; un fallo no sustituye datos reales por datos simulados. Las r?bricas API son de solo lectura: crear, editar y activar siguen deshabilitados. Cambiar el perfil simulado requiere editar el `.env` del backend y reiniciarlo; el navegador no ofrece selector de identidad ni puede elevar capacidades. El perfil `sin-capacidades` permite comprobar 403 y `sin-identidad` permite comprobar 401.

El adaptador conserva UUID, estado, per?odo y `revision`, aplana la jerarqu?a para presentaci?n y conserva los decimales originales como texto adicional. `activadaEn` no se transforma en fechas de vigencia del prototipo. `localStorage` no se migra ni modifica.
