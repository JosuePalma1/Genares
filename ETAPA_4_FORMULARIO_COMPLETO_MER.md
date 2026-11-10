# Etapa 4 — Adaptar el formulario completo de Genares al MER unificado

## Objetivo

Esta versión **reutiliza `frontend/src/componentes/FormularioRubrica.jsx`** (formulario institucional que ya existía) para presentar y editar **borradores orales** con los datos de S2/S3/S4. No reemplaza el editor original por un formulario improvisado.

El adaptador `frontend/src/dominio/adaptacionRubricaMer.js` convierte *solo para presentación* los datos que ya devuelve el servicio de PostgreSQL en categorías e indicadores reconocidos por el componente. No crea tablas, no cambia el MER, y no ejecuta migraciones.

## Lo que cambia respecto a la Etapa 3

- Las categorías e indicadores de la rúbrica se dibujan con el **formulario completo original de Genares**, incluyendo identificadores de categoría A, B, etc., indicadores numerados, campo de nota, observaciones, botón «Máx», estado por indicador y subtotal por categoría.
- Incluye un **resumen de etapa con totales y subtotales**. En pantallas amplias permanece visible al bajar por el formulario.
- Los valores del borrador se muestran con la precisión almacenada mientras se editan; el formato a dos decimales es únicamente visual para los totales.
- Se mantiene la protección frente a salir de la página con cambios sin guardar.
- El botón **Guardar borrador oral** usa exactamente el mismo servicio de etapa 3 y conserva su revisión, validaciones, auditoría y control de conflictos.
- El formulario no muestra la etiqueta «Cerrada» cuando simplemente está guardando o en modo de consulta sin permisos.

## Para instalarlo sin Docker

1. Descomprime el ZIP en una carpeta **nueva** y detén los procesos anteriores.
2. Copia tu `backend/.env` de la etapa 3 (el ZIP no lleva credenciales). Mantén las opciones de desarrollo local que ya probaste: `DB_NAME=genares_integrado_dev`, `ENABLE_INTEGRACION_DEV=true`, `LOCAL_DEV_OPEN_ACCESS=true`. No habilites esto en un equipo accesible desde Internet.
3. Abre PowerShell desde la carpeta nueva:

   ```powershell
   npm --prefix .\backend ci
   npm --prefix .\frontend ci
   npm run dev
   ```

4. Entra a **Trabajos → DEV - Tema de bina TI → Ver expediente → Ver rúbrica y evaluaciones**, o a la misma ruta de la etapa 3.
5. Selecciona **Juan** y **María Docente TI A**. El borrador existente de 8.50 y su observación deben mostrarse dentro del formulario institucional con resumen de etapa.
6. Prueba cambiar una observación, pulsa **Guardar borrador oral**, recarga y confirma que reaparezca.

## Lo que sigue siendo una simulación

- Los seeders actuales definen **una única categoría y un indicador por etapa**. El componente ya admite varias categorías/indicadores; verás esa capacidad cuando exista una rúbrica con estructura más rica en la base de desarrollo. No cambies la versión de rúbrica de un trabajo con notas registradas solo para observar más campos.
- Los docentes se seleccionan manualmente porque aún **no hay autenticación real por evaluador**.
- **No** está habilitado el cierre definitivo, la validación de firma, el cálculo consolidado final, la recuperación sin Internet ni la modificación de rúbricas.
- Este formulario solo guarda **borradores orales** de desarrollo. Las evaluaciones escritas de prueba permanecen cerradas y de solo lectura.
- El guardado se permite únicamente en `genares_integrado_dev` con los controles locales de etapa 3; **no utilices esta versión en una sustentación real**.
- El directorio contiene migraciones heredadas del prototipo. **No las ejecutes** sobre la base del MER unificado. No se requiere SQL adicional.

## Validación realizada en este paquete

- Sintaxis JSX/JS revisada en los componentes modificados.
- Comprobación directa del adaptador con dos categorías, tres indicadores, cero frente a pendiente y precisión de un borrador.
- La instalación de dependencias/compilación completa y la ejecución contra PostgreSQL local **no se pudieron efectuar aquí**: verifica el arranque y guardado en tu equipo.
