import { API_BASE_URL } from '../../infrastructure/config/rubricas';

// USUARIOS DE DEMOSTRACIÓN · rama demo/accesos-por-rol, solo desarrollo local.
// Guarda la sesión del usuario de prueba y la añade a cada petición. No es autenticación real:
// el backend la acepta solo en el entorno local y la contraseña es común (docs/s4/demo-usuarios.md).
const CLAVE = 'genares:demo:sesion:v1';

const almacen = () => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

export function leerSesionDemo(almacenamiento = almacen()) {
  try {
    const sesion = JSON.parse(almacenamiento?.getItem(CLAVE) ?? 'null');
    return sesion && typeof sesion.token === 'string' && sesion.usuario ? sesion : null;
  } catch {
    return null;
  }
}

export function guardarSesionDemo(sesion, almacenamiento = almacen()) {
  try { almacenamiento?.setItem(CLAVE, JSON.stringify({ token: sesion.token, usuario: sesion.usuario })); } catch { /* sin almacenamiento */ }
}

export function borrarSesionDemo(almacenamiento = almacen()) {
  try { almacenamiento?.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
}

/** Cabecera que identifica al usuario de demostración; vacía si no hay sesión. */
export function cabeceraSesionDemo(almacenamiento = almacen()) {
  const sesion = leerSesionDemo(almacenamiento);
  return sesion ? { Authorization: `Bearer ${sesion.token}` } : {};
}

async function pedir(ruta, { method = 'GET', body, signal, fetcher = (...a) => globalThis.fetch(...a) } = {}) {
  const respuesta = await fetcher(`${API_BASE_URL}/demo${ruta}`, {
    method,
    signal,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...cabeceraSesionDemo(),
      ...(method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Genares-Write-Intent': 'local-development' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const cuerpo = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);
  return { ok: respuesta.ok, estado: respuesta.status, cuerpo };
}

/** Lista de usuarios de demostración, o null si el backend no tiene la demostración. */
export async function consultarDemo(opciones) {
  try {
    const { ok, cuerpo } = await pedir('/estado', opciones);
    return ok && cuerpo?.habilitado ? cuerpo : null;
  } catch {
    return null;
  }
}

export async function entrarDemo(usuario, contrasena, opciones) {
  const { ok, cuerpo } = await pedir('/sesion', { ...opciones, method: 'POST', body: { usuario, contrasena } });
  if (!ok || !cuerpo?.token) throw new Error(cuerpo?.message ?? 'No se pudo iniciar la sesión de demostración.');
  guardarSesionDemo(cuerpo);
  return cuerpo.usuario;
}

/** Comprueba la sesión guardada; si el servidor ya no la acepta, la borra. */
export async function comprobarSesionDemo(opciones) {
  if (!leerSesionDemo()) return null;
  try {
    const { ok, estado, cuerpo } = await pedir('/sesion', opciones);
    if (ok && cuerpo?.usuario) return cuerpo.usuario;
    if (estado === 401) borrarSesionDemo();
    return null;
  } catch {
    // Sin conexión: se conserva la sesión para no perder borradores del tribunal.
    return leerSesionDemo()?.usuario ?? null;
  }
}

export async function salirDemo(opciones) {
  try { await pedir('/salir', { ...opciones, method: 'POST', body: {} }); } catch { /* se borra igual */ }
  borrarSesionDemo();
}
