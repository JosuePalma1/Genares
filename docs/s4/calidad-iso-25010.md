# Calidad de Genares S4 según ISO/IEC 25010

**Fecha:** 13/11/2026. Evalúa la rama `feature/mer-unificado-pasos-3-4` en el ambiente local de desarrollo.

## Qué es y qué significa cumplirla

ISO/IEC 25010 es un **modelo de calidad**: no se certifica. Divide la calidad de un programa en 9 características (versión de 2023). «Cumplirla» significa tres cosas:

1. Poner requisitos para cada característica.
2. Medirlos con un criterio claro: la norma ISO/IEC 25023 propone métricas.
3. Guardar la evidencia de cada medición: la norma ISO/IEC 25040 describe cómo evaluar.

Los requisitos no funcionales del Paso 1 (RNF-01 a RNF-18) se escribieron sin citar la norma, pero cubren sus 9 características. Este documento las relaciona, dice cómo se mide cada una y qué evidencia hay.

## Resumen

| Estado | Características |
| --- | --- |
| 🟢 Bien (en local) | Adecuación funcional · Eficiencia de desempeño · Fiabilidad · Protección |
| 🟡 Parcial | Compatibilidad · Capacidad de interacción · Mantenibilidad · Flexibilidad |
| 🔴 Débil | Seguridad: falta la identidad institucional |

En una frase: **la calidad interna es buena, pero la seguridad y lo que solo se puede medir desplegado siguen pendientes.**

## Detalle por característica

### 1. Adecuación funcional 🟢

Que el sistema haga lo que debe y lo haga bien.

- **Requisitos:** los 48 requisitos funcionales; RNF-08 (cálculo exacto).
- **Cómo se mide:** requisitos cumplidos frente a los pedidos; pruebas automáticas del cálculo y el redondeo (9,445 → 9,45; 4,20 + 4,50 = 8,70).
- **Evidencia:** [estado-paso-1.md](estado-paso-1.md); pruebas del backend (209) y del frontend (350), incluido el redondeo.
- **Falta:** las funciones que dependen de la identidad institucional y las actas con códigos oficiales.

### 2. Eficiencia de desempeño 🟢

Que responda rápido y use bien los recursos.

- **Requisito:** RNF-03.
- **Cómo se mide:** con 25 usuarios a la vez, el 95 % de las respuestas debe tardar 3 s o menos.
- **Evidencia:** [validacion-rnf-03-carga.md](validacion-rnf-03-carga.md). Con 202 trabajos: 67 ms en uso normal y 1,4 s en el caso extremo, sin errores.
- **Falta:** repetirla en el ambiente de aceptación, con la red real.

### 3. Compatibilidad 🟡

Que conviva y comparta datos con otros sistemas.

- **Requisitos:** RNF-11 y RNF-13.
- **Cómo se mide:** lee los datos de S2 y S3 sin copiarlos; todas las relaciones con claves foráneas; funciona junto a S1–S3 en el mismo repositorio.
- **Evidencia:** consultas a `s2.asignacion_tema` y `s3.asignacion_tribunal` en la misma base, sin tablas duplicadas.
- **Falta:** integrarlo en el repositorio común y cerrar los acuerdos con S2 y S3 (Paso 2, D-05 a D-08).

### 4. Capacidad de interacción (antes «usabilidad») 🟡

Que sea fácil de entender, usar y accesible.

- **Requisitos:** RNF-01 y RNF-14.
- **Cómo se mide:**
  - ningún error de validación sin explicación visible;
  - cero infracciones WCAG 2.1 A/AA en las pantallas principales;
  - foco visible y uso completo con teclado.
- **Evidencia:** revisión con axe-core de 21 pantallas a 360, 768 y 1440 px, sin infracciones; prueba de foco con Tab; sin desbordes horizontales (RNF-14 en [estado-paso-1.md](estado-paso-1.md)).
- **Falta:**
  - pruebas con usuarios reales: tribunal, coordinación y secretaría;
  - prueba con lector de pantalla;
  - quitar los códigos internos y el lenguaje técnico de las pantallas (sección 3 de [PENDIENTES.md](PENDIENTES.md)).

### 5. Fiabilidad 🟢

Que no pierda datos y se recupere de fallos.

- **Requisitos:** RNF-04, RNF-09, RNF-10 y RNF-18.
- **Cómo se mide:**
  - tras un corte de red o una recarga no se pierde ningún cambio guardado;
  - un reenvío no se aplica dos veces;
  - un conflicto conserva las dos versiones;
  - sin conexión no se puede cerrar una evaluación.
- **Evidencia:**
  - prueba en Chrome de la cola de borradores: guardado sin API y envío automático al volver;
  - pruebas automáticas de sincronización y conflictos;
  - en S4 no se borra nada, solo se oculta.
- **Falta:**
  - medir la disponibilidad del sistema desplegado;
  - simular un reinicio del servidor en plena operación;
  - probar el corte de red en el teléfono.

### 6. Seguridad 🔴

Que solo acceda quien debe y que todo quede registrado.

- **Requisitos:** RNF-05, RNF-06, RNF-07, RNF-15 y RNF-16.
- **Cómo se mide:**
  - ningún acceso protegido por HTTP sin cifrar;
  - pruebas negativas de acceso por URL y por API;
  - los datos inconsistentes se rechazan;
  - la auditoría no se puede editar.
- **Evidencia:**
  - **Integridad:** claves, restricciones y protecciones en PostgreSQL. Una evaluación cerrada no se modifica.
  - **Trazabilidad:** registro de cada cambio y auditoría que no se puede editar.
  - **Escrituras locales:** rechazadas si no vienen de la propia aplicación.
- **Falta (lo más importante del proyecto):**
  - usuarios reales y permisos por rol y carrera;
  - comprobar que quien firma una evaluación es su evaluador;
  - HTTPS;
  - revisar que los errores y registros no muestren datos de otros usuarios.

  Hoy todo funciona con una identidad de prueba que lo ve todo.

### 7. Mantenibilidad 🟡

Que sea fácil de entender, cambiar y probar.

- **Requisitos:** RNF-12 y RNF-17.
- **Cómo se mide:** módulos separados con pruebas; la suite de aceptación PA-01 a PA-18 pasa sin errores.
- **Evidencia:**
  - módulo S4 separado por funciones;
  - unas 560 pruebas automáticas;
  - decisiones y guías en `docs/s4/`;
  - Pasos 3 a 5 actualizados.
- **Falta:**
  - la suite de aceptación de extremo a extremo;
  - la comprobación automática en GitHub (CI).

### 8. Flexibilidad (antes «portabilidad») 🟡

Que se instale y funcione en distintos equipos.

- **Requisitos:** RNF-02 y RNF-11.
- **Cómo se mide:** pruebas completas en una tablet Android y un iPad; Chrome y Edge en escritorio; Safari en iPad.
- **Evidencia:** web en Chrome; APK probada en un teléfono Android; guía de instalación ([PRIMEROS-PASOS.md](PRIMEROS-PASOS.md)).
- **Falta:**
  - probar en tablet Android, iPad (Safari) y Edge;
  - desplegar fuera del PC de desarrollo;
  - la app con entrada propia del tribunal.

### 9. Protección («safety», nueva en 2023) 🟢

Que un fallo no cause daño. Aquí no hay riesgos físicos, así que aplica sobre todo como «fallar sin perder ni falsear notas».

- **Requisitos:** RNF-18 y reglas de negocio de cierre.
- **Evidencia:**
  - no se cierra una evaluación sin el servidor;
  - una nota pendiente no se cuenta como cero;
  - no se muestra nota final con evaluaciones incompletas.

## Qué falta para poder decir que se alinea con la norma

1. **Seguridad:** identidad institucional, permisos por rol y carrera, y HTTPS. Depende de la institución y del responsable de integración.
2. **Mediciones en el ambiente de aceptación:** rendimiento, disponibilidad y compatibilidad en tablet, iPad y Edge.
3. **Pruebas con usuarios reales**, para la capacidad de interacción, y corregir lo de la sección 3 de [PENDIENTES.md](PENDIENTES.md).
4. **Suite de aceptación PA-01 a PA-18** y comprobación automática en GitHub, para la mantenibilidad.
5. **Mantener este documento al día:** actualizar el estado y la evidencia de cada característica cuando cambie algo.

## Cómo repetir las mediciones

- **Pruebas automáticas:** `npm --prefix .\backend test` y `npm --prefix .\frontend test`.
- **Rendimiento:** método en [validacion-rnf-03-carga.md](validacion-rnf-03-carga.md).
- **Accesibilidad:** axe-core sobre las pantallas principales a 360, 768 y 1440 px. Hoy se hace con un script fuera del repositorio; conviene incluirlo en la suite de aceptación.
