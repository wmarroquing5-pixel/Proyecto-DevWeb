# DB-REC-SIMPLE-05 — Verificación previa de `dbo.RecetaLinea`

**Dictamen: NO-GO (23/10/2026).** Este corte fue documental y de lectura de código. No se ejecutó SQL, DDL, DML, migración, restauración, reinicio ni despliegue; la confirmación de recetas permanece deshabilitada. El dictamen no autoriza modificar `db_Clinica`.

## A. Evidencia SQL actual o bloqueo

En el proceso de esta tarea, `SQLCMD_SERVER`, `SQLCMD_DATABASE`, `SQLCMD_USER` y `SQLCMDPASSWORD` están ausentes. No se utilizó ni buscó una contraseña en archivos, configuraciones o secretos de la API. **No hubo conexión a Azure SQL**, por lo que `DB_NAME()`, `USER_NAME()` y el estado actual de `dbo.RecetaLinea` **no quedaron confirmados hoy**.

La última evidencia remota disponible es [DB-TRAT-AUDIT-01/FINAL.md](../../Docs/API-Clinica/Auditorias/DB-TRAT-AUDIT-01/FINAL.md), fechada 23/10/2026: `db_Clinica`, identidad `aud_empresa`, tabla `dbo.RecetaLinea` con 18 columnas, las seis de la tabla siguiente en `NOT NULL`, tres CHECK habilitados y confiables, tres FK habilitadas/confiables y cuatro índices. Los 16 controles de [DB-REC-SIMPLE-03/RESULTADO.md](../../Docs/API-Clinica/Pruebas/DB-REC-SIMPLE-03/RESULTADO.md) se hicieron en SQL Server Express aislado; no prueban el estado actual de Azure.

| Columna objetivo | Tipo previamente auditado | Estado previamente auditado | Estado actual |
|---|---|---|---|
| `UnidadInventario` | `nvarchar(30)` | `NOT NULL` | No verificable en este corte |
| `Dosis` | `decimal(12,3)` | `NOT NULL` | No verificable en este corte |
| `UnidadDosis` | `nvarchar(30)` | `NOT NULL` | No verificable en este corte |
| `Via` | `nvarchar(40)` | `NOT NULL` | No verificable en este corte |
| `Frecuencia` | `nvarchar(100)` | `NOT NULL` | No verificable en este corte |
| `DuracionDias` | `smallint` | `NOT NULL` | No verificable en este corte |

Para levantar este bloqueo, con la identidad autorizada `aud_empresa` se debe confirmar primero `DB_NAME() = db_Clinica` y `USER_NAME() = aud_empresa`; luego leer exclusivamente metadatos de `sys.tables`, `sys.columns`, `sys.types`, `sys.check_constraints`, `sys.foreign_keys`, `sys.foreign_key_columns`, `sys.indexes`, `sys.index_columns` y dependencias de `dbo.RecetaLinea`. Cotejar tipos, longitudes/precisión/escala, nulabilidad, las definiciones completas de los tres CHECK, las tres FK, los cuatro índices, PK/UNIQUE y objetos dependientes. La ausencia de diferencias debe quedar registrada antes de evaluar el cambio. **No consultar filas clínicas.**

El [script propuesto](../DB-REC-SIMPLE-02/ALTER-RECETA-LINEA.sql) permanece bloqueado con `@EjecucionAutorizada = 0`; verifica base, seis columnas, conteos/nombres/estado de restricciones y transacción con `XACT_ABORT`, `TRY/CATCH` y `ROLLBACK`. Su guardia no compara toda la definición de FK, índices ni `CK_RecetaLinea_Equivalencia`; el cotejo remoto externo sigue siendo imprescindible. No se modificó ni ejecutó el script.

## B. Respaldo y recuperación

La capacidad documentada de Azure SQL Database es la restauración a un punto en el tiempo dentro de la **retención configurada de esa base** mediante copias administradas por el servicio. La restauración crea **otra base**, no sobrescribe la existente; no debe suponerse una copia manual descargable. Fuentes: [copias automáticas y retención](https://learn.microsoft.com/en-us/azure/azure-sql/database/automated-backups-overview?view=azuresql), [restauración desde copias](https://learn.microsoft.com/en-us/azure/azure-sql/database/recovery-using-backups?view=azuresql).

Para `db_Clinica` no hay evidencia en las fuentes examinadas de **DBA responsable nominal**, política de retención efectiva, hora mínima/máxima restaurable, permiso operativo para restaurar, capacidad de crear la base de recuperación, ensayo de restauración o tiempo de recuperación aceptable. Todo ello queda **pendiente**, no inferido de la capacidad general del producto. El DBA designado debe verificarlo en el recurso de Azure y dejar constancia de un punto recuperable anterior a la ventana, sin ejecutar aquí restauración ni crear recursos.

Contingencia propuesta para aprobación: suspender el POST de recetas para todos los clientes, registrar la hora de corte y conservar el frontend deshabilitado; si el script falla antes de `COMMIT`, comprobar rollback y metadatos; si falla después, contener escrituras y decidir con el DBA entre corrección compatible hacia adelante o restauración a una **base nueva** y reconciliación de datos. Una restauración anterior al cambio omitiría operaciones posteriores, por lo que el responsable clínico y el DBA deben aprobar cómo preservarlas. No restablecer `NOT NULL` si ya existen recetas simples con valores `NULL`, ni rellenar campos clínicos con datos ficticios.

## C. Compatibilidad backend y artefactos

- `CrearRecetaClinicaRequest` conserva cabecera, `ClaveOperacion` y líneas con solo `IdMedicamento` y `CantidadPrescritaUnidades`; rechaza miembros JSON no previstos. `RecetaLinea` y el mapeo de `ClinicaDbContext` tienen las seis propiedades C# anulables con tipos/longitudes previstos. No se encontró `DestinoMedicamento` en entidad, DTO, mapeo, servicio ni modelo Angular del flujo vigente.
- `RecetaClinicaPreparador` calcula `HashSolicitud` versión 3 sobre el contenido simplificado. `RecetaClinicaService.CrearAsync` usa transacción `Serializable` y `UPDLOCK, HOLDLOCK` para la clave; crea `Tratamiento`, `RecetaClinica` y líneas, dejando las seis propiedades en `NULL`. No asigna lote ni crea movimiento de inventario. **Este código sigue siendo incompatible con el estado Azure `NOT NULL` previamente auditado.**
- El controlador expone `POST /api/consultas/{idConsulta}/recetas` con `Historial/Crear`; devuelve 201 en creación y 200 para reintento confirmado. `ConflictException` se traduce a 409 y `ExternalDependencyException` a 503; un COMMIT incierto se comunica como 503 para conservar la misma clave. Esto está comprobado por lectura de código, no por una prueba HTTP/productiva en este corte.
- El árbol está en HEAD `969812a` **con cambios locales sin commit** en servicio, pruebas y frontend. Existen directorios de salida Release .NET y `dist/web-clinica`, pero no se comprobó que representen exactamente este árbol ni que sean los binarios de una instancia activa. Antes de GO se requieren artefactos identificados por hash/versión, build Release, pruebas focalizadas y SQL aisladas, y verificación del proceso realmente ejecutado. No se reinició ningún servicio.

## D. Bloqueo WebClinica

`RECETA_SIMPLE_WRITE_ENABLED` tiene factory `false`. El botón `Guardar tratamiento y receta` está deshabilitado con ese valor; `solicitarConfirmacion()` rechaza abrir la confirmación y `confirmar()` impide `historial.crearReceta(request)`. La única provisión `true` localizada está en la prueba del componente. La búsqueda en `WebClinica/src/app` encontró **una sola llamada funcional** a `crearReceta()`, dentro de ese componente; no se encontró otra ruta Angular que lo invoque. El servicio HttpClient sí conserva el método público y la API acepta peticiones directas autorizadas: el token Angular **no es una barrera del servidor**. Para una futura ventana se necesitará suspensión operativa del POST para todos los clientes, aprobada por separado. No se cambió ni activó el token.

## E. Riesgos pendientes

| Riesgo | Evidencia / control pendiente |
|---|---|
| Deriva del esquema Azure | Falta SELECT actual de metadatos con `aud_empresa`; si difiere, no usar el script. |
| Recuperación no demostrada | DBA, retención real, punto restaurable y plan de reconciliación no documentados. |
| Cliente directo o versión anterior | La barrera Angular no desactiva el POST de API; bloquearlo operativamente durante el cambio. |
| Artefactos sin procedencia | Cambios locales y salidas de build no prueban versión desplegada; fijar hashes y validar el proceso. |
| Reversión posterior a recetas simples | `ALTER ... NOT NULL` no es seguro si existen nuevos `NULL`; requiere decisión de preservación clínica. |
| Alcance farmacéutico | Una receta sin unidad/dosis no acredita despacho o administración; esos flujos continúan fuera de alcance. |

## F. Condiciones GO/NO-GO

**NO-GO actual.** Para considerar GO **solo para solicitar autorización de ejecución**, deben constar todas estas evidencias: (1) metadatos Azure recientes y exactos con identidad de auditoría; (2) responsable DBA, retención real y recuperación probada o plan verificable; (3) copia controlada del script y revisión de dependencias completas; (4) ventana y bloqueo del POST para todos los clientes; (5) artefactos API/Angular identificados y pruebas focalizadas, de integración SQL aislada y regresión completadas; (6) secuencia de postcheck y contingencia aprobada. Un GO técnico no ejecuta DDL ni habilita Angular. Si falta uno, mantener NO-GO y `RECETA_SIMPLE_WRITE_ENABLED = false`.

## G. Autorizaciones necesarias

Hace falta autorización nueva, expresa y acotada para cualquier modificación de `dbo.RecetaLinea`, con entorno, seis columnas, script/copia aprobada, identidad ejecutora distinta de `aud_empresa`, ventana, DBA y reversión. La regla vigente de [AGENTS.md](../AGENTS.md) y la skill `database-contract` mantienen la base inmutable; esta tarea no constituye excepción. También requieren autorización separada el bloqueo operativo del POST, la ejecución de una restauración, el despliegue de API/Angular y la activación del guardado. No iniciar otra fase automáticamente.

**Verificación del corte:** revisión estática focalizada; no se ejecutaron pruebas ni compilaciones nuevas porque no hubo cambios funcionales. Se conservaron todos los cambios previos del repositorio.
