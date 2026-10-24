# DB-REC-SIMPLE-04 — Plan de activación segura del guardado de recetas

**Estado:** preparación documental. La confirmación permanece deshabilitada. No se ejecutó DDL, DML, migración, prueba con datos productivos ni despliegue.

## A. Estado SQL real y alcance de la evidencia

La última verificación remota documentada en `Docs/API-Clinica/Auditorias/DB-TRAT-AUDIT-01/FINAL.md` (23/10/2026), hecha con `aud_empresa` y solo catálogos de `db_Clinica`, registró `dbo.RecetaLinea` con 18 columnas. Las seis columnas siguientes seguían `NOT NULL`:

| Columna | Contrato remoto previamente verificado | Contrato requerido por la receta simple |
|---|---|---|
| `UnidadInventario` | `nvarchar(30) NOT NULL` | `NULL` |
| `Dosis` | `decimal(12,3) NOT NULL` | `NULL` |
| `UnidadDosis` | `nvarchar(30) NOT NULL` | `NULL` |
| `Via` | `nvarchar(40) NOT NULL` | `NULL` |
| `Frecuencia` | `nvarchar(100) NOT NULL` | `NULL` |
| `DuracionDias` | `smallint NOT NULL` | `NULL` |

**Nueva consulta remota de este corte: pendiente.** La ruta local previamente autorizada para la credencial `aud_empresa` no está disponible para este proceso y ninguna de las cuatro variables SQLCMD está presente. No se abrió una conexión. Antes de cualquier autorización de cambio, repetir la lectura con esa identidad: comprobar `DB_NAME()`/`USER_NAME()` y luego consultar `sys.columns`, `sys.types`, `sys.check_constraints`, `sys.foreign_keys`, `sys.indexes` y dependencias de `dbo.RecetaLinea`, sin filas clínicas. Si el estado difiere del contrato anterior, detener el despliegue y revisar el script. Los 16 controles aprobados en SQL Server aislado, según `Docs/API-Clinica/Pruebas/DB-REC-SIMPLE-03/RESULTADO.md`, demuestran compatibilidad del esquema de prueba, no el estado presente de Azure.

## B. Compatibilidad backend

`RecetaLinea.cs` define las seis propiedades como anulables; `ClinicaDbContext.cs` conserva los tipos/longitudes y las tres restricciones CHECK. `RecetaClinicaDtos.cs` recibe por línea únicamente `IdMedicamento` y `CantidadPrescritaUnidades`. `RecetaClinicaService.cs` intenta insertar las seis propiedades en `NULL` dentro de una transacción `Serializable`, después de crear `Tratamiento` y `RecetaClinica`. El POST es `POST /api/consultas/{idConsulta}/recetas` con permiso `Historial/Crear`; las lecturas son `GET /api/consultas/{idConsulta}/recetas` y `GET /api/recetas/{idReceta}`. Con las seis columnas aún `NOT NULL` en Azure, esa inserción no es compatible y el POST no debe habilitarse allí.

El servicio calcula `HashSolicitud` versión 3, conserva `ClaveOperacion` y busca la clave bajo `UPDLOCK, HOLDLOCK`; una receta nueva no selecciona lote ni crea movimientos de inventario. Antes de activar, verificar con el artefacto exacto a desplegar que el POST, ambas lecturas, la conciliación de reintentos y el mapeo EF corresponden al mismo contrato; el código local contiene cambios sin commit que no prueban qué binario ejecuta una instancia. Una respuesta 201 por sí sola no acredita persistencia ni ausencia de descuento.

## C. Barrera frontend

`receta-form.component.ts` declara `RECETA_SIMPLE_WRITE_ENABLED` con valor predeterminado `false`; el botón `Guardar tratamiento y receta` está deshabilitado cuando es falso. `solicitarConfirmacion()` muestra un error y `confirmar()` vuelve a impedir el POST aunque se intente invocar la acción directamente. La única provisión `true` encontrada está en `receta-form.component.spec.ts`. No hay una comprobación automática de compatibilidad SQL/API en tiempo de ejecución: la barrera actual es un token de inyección, no una señal del servidor.

La futura habilitación requiere un cambio de configuración/provisión **específico del entorno**, con valor inicial falso y asociado al artefacto de API y base verificados. Mantener los guardas de método y la protección del botón. No activar el token por la mera disponibilidad del endpoint o por pasar pruebas con mocks. El despliegue de Angular debe ser posterior a la verificación SQL y al arranque del backend compatible; ante cualquier discrepancia, conservar o restablecer `false`.

## D. Dependencias y script protegido

`DB-REC-SIMPLE-02/ALTER-RECETA-LINEA.sql` sigue bloqueado por `@EjecucionAutorizada = 0`, en un solo lote sin `GO`. Comprueba `DB_NAME() = db_Clinica`, tabla, 18 columnas, tipos, tamaños, nulabilidad inicial, colación, ausencia de DEFAULT e índices sobre las seis columnas, tres FK, cuatro índices y tres CHECK habilitados/confiables. Verifica la definición esperada de `CK_RecetaLinea_Cantidades` y `CK_RecetaLinea_Texto`; los retira y recrea con `WITH CHECK` dentro de una transacción. Usa `SET XACT_ABORT ON`, `TRY/CATCH`, `ROLLBACK` y verificaciones posteriores antes del `COMMIT`. `CK_RecetaLinea_Equivalencia`, PK, FK y claves únicas no se cambian. **Límite del guardia:** para FK e índices comprueba conteos, nombres y estado, pero no coteja todas las columnas/definiciones; tampoco compara la expresión completa de `_Equivalencia`. El precheck externo debe cotejar esas definiciones y las dependencias antes de autorizar la copia ejecutable. La normalización de las otras expresiones CHECK es estricta: una deriva semántica o de formato puede detenerlo y exige revisión, nunca omitir el guardia.

`Docs/API-Clinica/Pruebas/DB-REC-SIMPLE-02/VALIDACION.md` explica el comportamiento de `CHECK` frente a `NULL`, dependencias y reversión. `Docs/API-Clinica/Pruebas/DB-REC-SIMPLE-03/RESULTADO.md` registra 16 controles aislados: nulabilidad, CHECK confiables, PK/FK/índices, filas previas, rechazos de valores inválidos y rollback inyectado. También registra que `sqlcmd -I` fue necesario para el índice filtrado del montaje de prueba. **El script no realiza respaldo**; ese es un prerrequisito operativo independiente. El original no se desbloquea ni se ejecuta en esta fase.

## E. Secuencia propuesta para una ventana futura

1. **Autorizar y congelar alcance.** Obtener una autorización nueva y expresa que indique entorno, DBA responsable, cambio exacto de las seis nulabilidades, ventana, artefactos API/Angular y condición de reversión. Resolver expresamente la excepción a la regla actual de base inmutable de `AGENTS.md`/`database-contract`. Congelar nuevas confirmaciones; mantener el token Angular en `false` y bloquear temporalmente el POST en el punto de entrada de la API para todos los clientes durante la ventana. La barrera Angular por sí sola no protege a otros clientes ni una llamada directa. Autorizar y documentar ese bloqueo operativo por separado.
2. **Precheck y respaldo.** Con identidad de auditoría, cotejar de nuevo los metadatos y dependencias exactos. El DBA comprueba retención y punto de recuperación de Azure SQL, prepara un respaldo/restauración verificable según la política del entorno y registra hora, base, responsable y evidencia. No usar `aud_empresa` para DDL. Si falla cualquier cotejo o respaldo, no aplicar el cambio.
3. **Aplicación separadamente autorizada.** El DBA prepara una copia controlada del script protegido para la ejecución aprobada; no modifica el original. Verifica identidad, base, colación y opciones de sesión. Ejecuta solo durante la ventana, con registro de salida y supervisión. Un error antes de `COMMIT` debe terminar en `ROLLBACK`; no continuar con un script parcialmente ejecutado.
4. **Postcheck SQL.** Con lectura de metadatos, comprobar exactamente seis columnas `NULL` con tipos/longitudes iguales, 18 columnas totales, tres CHECK habilitados y confiables, tres FK, cuatro índices y ninguna diferencia inesperada en PK/UNIQUE/defaults/dependencias. Si falla, mantener la confirmación suspendida.
5. **API y proceso local.** Desplegar el artefacto backend aprobado y verificar qué proceso/puerto lo ejecuta, su configuración externa y conexión al entorno esperado. En local, identificar PID y lanzador antes de detenerlo; reiniciar esa instancia con el binario aprobado, sin reiniciar una API que apunte a producción para pruebas de escritura. Confirmar GET y permisos con operaciones de lectura.
6. **Prueba no productiva.** En un entorno de pruebas compatible, con paciente/consulta/diagnóstico/medicamentos sintéticos, ejecutar una y varias líneas, GET por receta y consulta, reintento de misma clave/cuerpo, 409 para mismo identificador con contenido distinto, fallo con rollback y rechazo por permisos. Comparar lote y movimientos antes/después: no deben cambiar. No insertar recetas sintéticas en `db_Clinica` productiva.
7. **Angular.** Solo tras los pasos anteriores y una decisión explícita de salida, proveer `RECETA_SIMPLE_WRITE_ENABLED = true` únicamente al destino verificado; comprobar URL de API, versión del contrato, 201/200/409, mensajes de error y ausencia de doble envío. Observar errores de persistencia, reintentos y métricas de API. La activación en producción necesita una autorización separada.

## F. Criterios de avance y verificaciones

No pasar al siguiente paso si falta: evidencia remota actual, respaldo recuperable, aprobación del cambio de esquema, mapeo EF/DTO/servicio concordante, compilación Release y pruebas .NET focalizadas/SQL aisladas, `npm run verify` y pruebas Angular relacionadas, build de producción, validación de permisos/idempotencia/concurrencia, o prueba de punta a punta **no productiva**. Registrar hashes/versiones de los artefactos y comprobar que la API activa corresponde a ellos. Ejecutar `git diff --check` antes de liberar. El estado de Azure no se deduce de un build, de un 201 simulado ni de los 16 controles aislados.

## G. Recuperación

- **Fallo antes de `COMMIT`:** el `TRY/CATCH`, `XACT_ABORT` y `ROLLBACK` del script deben revertir el cambio; comprobar metadatos y mantener Angular bloqueado.
- **Fallo posterior al `COMMIT`, antes de nuevas recetas:** deshabilitar confirmación, retirar el nuevo frontend/backend si corresponde, verificar metadatos y decidir con DBA una reversión de nulabilidad solo después de comprobar que no hay filas incompatibles.
- **Fallo después de crear recetas simples:** no ejecutar `ALTER ... NOT NULL` a ciegas ni rellenar campos con datos clínicos ficticios. Contener el POST, conciliar las claves de operación y elegir un arreglo compatible hacia adelante o recuperación a un punto autorizado, evaluando pérdida de cambios posteriores con responsables clínicos/DBA. Conservar registros y trazabilidad; no repetir solicitudes inciertas con una clave nueva.
- **Problema de API/Angular sin problema SQL:** volver a `RECETA_SIMPLE_WRITE_ENABLED = false`, restaurar el artefacto anterior compatible y verificar lectura de recetas existentes. Cualquier nueva escritura requiere un nuevo pase de compatibilidad.

## H. Autorizaciones y pendientes

Pendientes: restablecer acceso de solo lectura a `aud_empresa` para cotejo actual; aprobación excepcional y específica de DDL en Azure; responsable y evidencia de respaldo/recuperación; ventana y artefactos aprobados; pruebas no productivas de punta a punta; aprobación independiente para activar API y Angular en el destino final. No están autorizados despacho, administración clínica, descuentos de inventario ni cambios de permisos. **DB-REC-SIMPLE-04 queda preparado documentalmente, pero la confirmación de recetas sigue bloqueada.**
