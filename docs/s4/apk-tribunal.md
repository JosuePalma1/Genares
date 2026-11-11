# APK de desarrollo para el tribunal (S4-15)

La APK empaqueta **el mismo frontend de Genares** con Capacitor: las mismas pantallas, el mismo `FormularioRubrica` y los mismos borradores locales de S4-16. No es otra aplicación ni tiene lógica propia. Es una **APK de desarrollo**: usa la identidad local de pruebas, se conecta a tu backend local por USB y no debe distribuirse.

## Qué hace

- **Abre sin Internet.** Las pantallas van dentro de la APK (`assets/public`), así que la aplicación arranca aunque no haya red.
- **Evalúa sin conexión lo ya descargado.** Si una evaluación se abrió antes con conexión, su rúbrica queda copiada en el dispositivo y se puede seguir calificando sin red (Paso 2, A.3.4).
- **Recupera los borradores (S4-16).** Cada cambio se guarda en el dispositivo y sobrevive a perder la red, recargar o cerrar la aplicación.
- **Respaldo nativo de borradores (RNF-09).** En la APK cada borrador se copia también a `@capacitor/preferences`, que lo guarda en el almacenamiento nativo de la app. Si el `localStorage` del WebView se vacía, al abrir una evaluación se restauran desde esa copia (se conserva la versión más reciente). En el navegador no cambia nada.
- **Sincroniza al reconectar.** Los borradores «Pendiente de sincronización» se envían solos a PostgreSQL al volver la conexión; los conflictos de revisión no se sobrescriben.
- **No cierra sin servidor.** El cierre de una evaluación exige conexión y confirmación del servidor.

## Requisitos para compilar

| Herramienta | Versión |
| --- | --- |
| Node.js | 22 |
| Android SDK | API 36 (instalado con Android Studio) |
| **JDK** | **21**. El JDK 25 que trae Android Studio no funciona con el Gradle 8.14.3 de Capacitor 8.6.0 («Unsupported class file major version 69»). En Android Studio: *Settings › Build Tools › Gradle › Gradle JDK* → un JDK 21. |

`frontend/android/local.properties` (ignorado por Git) debe apuntar al SDK, por ejemplo `sdk.dir=C:/Users/<usuario>/AppData/Local/Android/Sdk`.

## Compilar la APK

Desde `frontend/`:

```powershell
npm install                    # incluye @capacitor/preferences (respaldo de borradores)
npm run android:build          # vite build --mode android + cap sync android
cd android
# JAVA_HOME debe ser la carpeta real de un JDK 21 (la que contiene bin\java.exe), por ejemplo:
$env:JAVA_HOME = "C:\Users\josue\.jdks\jbr-21.0.11"
.\gradlew assembleDebug
```

Para encontrar los JDK instalados: `Get-ChildItem "$env:USERPROFILE\.jdks", "C:\Program Files\Java", "C:\Program Files\Eclipse Adoptium" -Directory -ErrorAction SilentlyContinue`. Comprueba la versión con `& "<carpeta>\bin\java.exe" -version`; debe decir 21. `$env:JAVA_HOME` solo dura en esa ventana de PowerShell.

Resultado: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`.

El modo `android` usa `frontend/.env.android`, que apunta la API a `http://localhost:3001/api/v1`. El navegador sigue usando el proxy de Vite como siempre.

## Conectar la tablet al backend local

El backend de desarrollo escucha **solo** en `127.0.0.1`; no se abre a la red. La tablet lo alcanza por USB:

1. En `backend/.env`, el origen de la APK debe estar permitido:
   `LOCAL_DEV_WRITE_ORIGINS=http://127.0.0.1:5173,http://localhost`
2. Inicia el sistema: `npm run dev` desde la raíz.
3. Conecta la tablet con depuración USB activada y ejecuta, desde la raíz del repositorio (`adb` viene en el Android SDK y normalmente no está en el PATH):
   ```powershell
   $adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
   & $adb devices                     # la tablet debe aparecer como "device"
   & $adb install -r frontend\android\app\build\outputs\apk\debug\app-debug.apk
   & $adb reverse tcp:3001 tcp:3001
   ```
   El túnel de `adb reverse` se pierde al desconectar el cable; repite esa línea al reconectar.
   `adb reverse` hace que `localhost:3001` de la tablet llegue al `127.0.0.1:3001` del PC; el backend la ve como conexión local.

Solo en modo local, el backend acepta ese origen: CORS para los orígenes exactos de `LOCAL_DEV_WRITE_ORIGINS` y escrituras `same-site` desde ellos. Un origen no listado recibe 403 y ninguna cabecera CORS.

## Verificado en el PC (11/11/2026)

- **APK generada** (`app-debug.apk`, 4,3 MB): paquete `dev.genares.s4.tribunal`, Android 7 (API 24) o superior, objetivo API 36, único permiso relevante `INTERNET`, firma de depuración. Contiene `index.html`, el JavaScript y el CSS del frontend, y apunta a `http://localhost:3001/api/v1`.
- **Backend:** la petición previa de CORS desde `http://localhost` recibe 204 con `Access-Control-Allow-Origin: http://localhost`; una escritura `same-site` de la APK llega al servidor; un origen ajeno recibe 403 sin cabeceras CORS. Pruebas automáticas de CORS y de la protección.
- **Recorrido en el entorno web de la APK** (paquete Android servido en `http://localhost`, API con CORS, backend cortado y restablecido desde Chrome):
  1. con conexión se abre la evaluación y se guarda la copia del expediente;
  2. al editar con conexión, el cambio llega al servidor;
  3. sin backend, la rúbrica se muestra desde la copia, el cambio queda «Pendiente de sincronización» y el cierre está deshabilitado;
  4. al recargar sin backend se recupera el borrador;
  5. al reconectar se sincroniza solo y el borrador local se elimina (confirmado en PostgreSQL; la nota de prueba se restauró después).

## Pendiente de probar en una tablet física

No hay emulador ni tablet en el equipo donde se generó la APK. Falta comprobar:

- [x] La APK se instala (`adb install`) y abre en la tablet del tribunal.
- [ ] Con el **modo avión activado**, la aplicación abre y muestra una evaluación descargada antes.
- [ ] La **WebView envía `Sec-Fetch-Site: same-site`** en las escrituras. Si no lo enviara, guardar respondería 403 «LOCAL_WRITE_ORIGIN_REJECTED»; es el punto técnico más incierto.
- [ ] Un borrador hecho sin conexión sobrevive a **forzar el cierre** de la aplicación y a **reiniciar** la tablet.
- [ ] Respaldo nativo: con un borrador pendiente, borrar **solo la caché** de la app en Ajustes de Android y reabrir; el borrador debe volver.
- [ ] Al reconectar (`adb reverse` activo) el borrador pendiente se sincroniza solo.
- [ ] Conflicto real entre dos dispositivos que editan la misma evaluación.
- [ ] Diseño en la tablet: horizontal y vertical, teclado numérico en las notas, botón Atrás de Android.
- [ ] El cierre de la evaluación queda deshabilitado sin conexión y funciona con conexión.

## Decisiones pendientes

- **Entrada separada del tribunal.** El Paso 5 describe S4-15 como «APK tribunal con Capacitor y entrada separada». Hoy la APK abre la aplicación completa en Inicio; una entrada solo con «Mis evaluaciones» necesita definirse con el equipo.
- **Producción.** Esta APK usa HTTP en `localhost`, depuración de WebView activada y la identidad local. Una versión para el tribunal real requiere la autenticación institucional (Paso 9), HTTPS hacia el servidor institucional y firma de publicación.
