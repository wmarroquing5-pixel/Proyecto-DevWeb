# DB-AUDIT-AZURE-01 — Auditoría del esquema de Consultas

**Estado: PARCIAL; comparación remota pendiente.** Fecha: 22/10/2026. Esta intervención fue de solo lectura. No se abrió una conexión a Azure SQL, no se consultaron registros clínicos y no se ejecutó SQL, migraciones ni pruebas con DDL/DML. En consecuencia, las afirmaciones sobre `script.sql` **no son afirmaciones sobre el estado actual de Azure SQL**.

## A. Identificación de la base auditada y procedencia

| Fuente | Evidencia | Alcance |
|---|---|---|
| Script del usuario | `C:\Users\DESARROLLO\Desktop\script.sql`, 66 158 bytes, SHA256 `59AEA7DFC361E81FE865478D24F2750C40F2489F028B5EB5AD40847FD1FF19CB`; encabezados fechados 12/10/2026 | Esquema documental, no prueba de Azure actual |
| Código | `API-Clinica/Data/ClinicaDbContext.cs`, entidades, DTO, servicios y controladores | Contrato que la API espera |
| Configuración local | La API usa `ConnectionStrings:DefaultConnection` desde User Secrets; solo se inspeccionaron nombres de claves y rasgos no secretos | El valor configurado apunta al destino de producción documentado por `API-Clinica.AzureSqlLockProbe`; no existe un perfil independiente de auditoría de solo lectura ni `Application Intent=ReadOnly` |
| Azure SQL | **No conectado** | Nombre efectivo, edición, versión, identidad, esquema, permisos y metadatos reales: **NO VERIFICABLES** |

El nombre `db_Clinica` y el servidor `srwemg.database.windows.net` proceden del código del probador existente, **no de una consulta a Azure**. `sqlcmd` está instalado, pero tener cliente y credenciales ordinarias no demuestra un principal de solo lectura. No se usó `DefaultConnection` para esta auditoría.

## B. Inventario de tablas

El script define 26 tablas `dbo`: `AsignacionHabitacion`, `Bitacora`, `Categoria`, `Clinica`, `Consulta`, `ContactoEmergencia`, `Diagnostico`, `Empleado`, `Especialidad`, `Examen`, `Factura`, `FacturaDetalle`, `Habitacion`, `HistorialMedico`, `LoteMedicamento`, `Marca`, `Medicamento`, `MovimientoInventario`, `Paciente`, `Permiso`, `Rol`, `Servicio`, `Sucursal`, `Tratamiento`, `Turno` y `Usuario`. Las ocho tablas solicitadas aparecen en ese script y están mapeadas por EF Core. Su existencia **real y actual** en Azure queda pendiente.

## C–D. Inventario documental de columnas, tipos, nulabilidad y restricciones

Una fila representa una columna del script. `—` significa que el script no declara esa propiedad. `PK` implica identidad `IDENTITY(1,1)` en estos ocho casos; `FK` indica la tabla referenciada; `D` es valor por defecto; `CHK` es restricción de dominio. Todos los tipos `datetime2` del script tienen precisión 7. **Tipo, longitud, nulabilidad, identidad, defaults y restricciones reales en Azure: NO VERIFICABLES en todas las filas.**

| Tabla | Columna | Tipo del script | NULL | PK/FK/identidad/default/check del script |
|---|---|---|---|---|
| Paciente | IdPaciente | int | No | PK; identidad |
| Paciente | Nombres | nvarchar(100) | No | — |
| Paciente | Apellidos | nvarchar(100) | No | — |
| Paciente | DPI | nvarchar(20) | Sí | — |
| Paciente | FechaNacimiento | date | No | — |
| Paciente | Genero | nvarchar(1) | Sí | — |
| Paciente | Telefono | nvarchar(20) | Sí | — |
| Paciente | Correo | nvarchar(100) | Sí | — |
| Paciente | FechaRegistro | datetime2(7) | No | D `sysutcdatetime()` |
| Paciente | Activo | bit | No | D `1` |
| Paciente | TipoSangre | nvarchar(10) | Sí | — |
| Paciente | Nit | nvarchar(50) | Sí | — |
| Paciente | NombreFacturacion | nvarchar(150) | Sí | — |
| Paciente | Direccion | nvarchar(150) | Sí | — |
| Paciente | UrlFoto | nvarchar(500) | Sí | —; fotografía, no documento de examen |
| Consulta | IdConsulta | int | No | PK; identidad |
| Consulta | IdPaciente | int | No | FK Paciente |
| Consulta | IdMedico | int | No | FK Empleado |
| Consulta | IdSucursal | int | No | FK Sucursal |
| Consulta | FechaConsulta | datetime2(7) | No | — |
| Consulta | MotivoConsulta | nvarchar(300) | Sí | — |
| Consulta | Sintomas | nvarchar(300) | Sí | — |
| Consulta | Observaciones | nvarchar(300) | Sí | — |
| Consulta | PesoLb | float | Sí | — |
| Consulta | PresionDiastolica | float | Sí | — |
| Consulta | PresionSistolica | float | Sí | — |
| Consulta | AlturaCm | int | Sí | — |
| Consulta | IdClinica | int | Sí | FK Clinica |
| Examen | IdExamen | int | No | PK; identidad |
| Examen | IdConsulta | int | Sí | FK Consulta |
| Examen | NombreExamen | nvarchar(200) | No | — |
| Examen | FechaExamen | datetime2(7) | No | — |
| Examen | FechaResultado | date | Sí | — |
| Examen | Prioridad | nvarchar(20) | Sí | CHK `Baja`, `Media`, `Alta` |
| Examen | IdDiagnostico | int | Sí | FK Diagnostico |
| Examen | IdTurno | int | Sí | FK Turno |
| Diagnostico | IdDiagnostico | int | No | PK; identidad |
| Diagnostico | IdConsulta | int | No | FK Consulta |
| Diagnostico | Descripcion | nvarchar(300) | No | — |
| Diagnostico | FechaRegistro | datetime2(7) | No | D `sysutcdatetime()` |
| Tratamiento | IdTratamiento | int | No | PK; identidad |
| Tratamiento | IdConsulta | int | No | FK Consulta |
| Tratamiento | Descripcion | nvarchar(300) | No | — |
| Tratamiento | Indicaciones | nvarchar(300) | Sí | — |
| Tratamiento | FechaInicio | date | No | — |
| Tratamiento | FechaFin | date | Sí | — |
| Tratamiento | IdLote | int | Sí | FK LoteMedicamento |
| Tratamiento | Cantidad | smallint | Sí | CHK `> 0` |
| HistorialMedico | IdHistorial | int | No | PK; identidad |
| HistorialMedico | IdConsulta | int | Sí | FK Consulta |
| HistorialMedico | FechaHistorial | datetime2(7) | No | — |
| HistorialMedico | Descripcion | nvarchar(300) | No | — |
| HistorialMedico | IdDiagnostico | int | Sí | FK Diagnostico |
| AsignacionHabitacion | IdAsignacion | int | No | PK; identidad |
| AsignacionHabitacion | IdHabitacion | int | No | FK Habitacion |
| AsignacionHabitacion | IdPaciente | int | No | FK Paciente |
| AsignacionHabitacion | FechaIngreso | datetime2(7) | No | — |
| AsignacionHabitacion | FechaEgreso | datetime2(7) | Sí | — |
| AsignacionHabitacion | Observaciones | nvarchar(300) | Sí | — |
| AsignacionHabitacion | TipoAsignacion | nvarchar(20) | No | D `Paciente`; CHK `Paciente`/`Acompañante` |
| Habitacion | IdHabitacion | int | No | PK; identidad |
| Habitacion | IdSucursal | int | No | FK Sucursal |
| Habitacion | NumeroHabitacion | nvarchar(20) | No | — |
| Habitacion | TipoHabitacion | nvarchar(50) | Sí | — |
| Habitacion | Estado | nvarchar(20) | No | CHK `Libre`/`Ocupada`/`En limpieza` |
| Habitacion | Activa | bit | No | D `1` |

El script no define una estructura de documentos de examen. `Examen.FechaResultado` no es el contenido del resultado. La columna `Paciente.UrlFoto` se refiere a fotografía del paciente y no debe reutilizarse como índice documental clínico.

## E. Relaciones documentadas

| Origen → destino | FK en script | EF Core | Azure actual |
|---|---|---|---|
| Consulta → Paciente | `FK_Consulta_Paciente` | Mapeada | No verificable |
| Consulta → Empleado (médico) | `FK_Consulta_Medico` | Mapeada | No verificable |
| Consulta → Sucursal | `FK_Consulta_Sucursal` | Mapeada | No verificable |
| Consulta → Clinica | `FK_Consulta_Clinica` (`IdClinica` nullable) | Mapeada | No verificable |
| Examen → Consulta | `FK_Examen_Consulta` (nullable) | Mapeada | No verificable |
| Examen → Diagnostico | `FK_Examen_Diagnostico` (nullable) | Mapeada | No verificable |
| Diagnostico → Consulta | `FK_Diagnostico_Consulta` | Mapeada | No verificable |
| Tratamiento → Consulta | `FK_Tratamiento_Consulta` | Mapeada | No verificable |
| HistorialMedico → Consulta | `FK_Evolucion_Consulta` (nullable) | Mapeada | No verificable |
| AsignacionHabitacion → Paciente | `FK_Asignacion_Paciente` | Mapeada | No verificable |
| AsignacionHabitacion → Habitacion | `FK_Asignacion_Habitacion` | Mapeada | No verificable |

`AsignacionHabitacion.IdConsulta` **NO EXISTE EN EL SCRIPT**, y no existe FK ni propiedad EF equivalente. Una asignación puede preceder a las consultas del paciente; por ello no se recomienda añadir una relación obligatoria ni inferirla por proximidad de fechas. Solo Azure podrá confirmar que no se añadió después de la fecha del script.

## F–G. Comparación entre script, EF Core y API

Los campos de las ocho tablas del script están representados por el mapeo EF, con estas traducciones de nombre comprobadas: `Paciente.Genero` ↔ `Paciente.Sexo`; `HistorialMedico.IdHistorial` ↔ `Evolucion.IdEvolucion`; `HistorialMedico.FechaHistorial` ↔ `Evolucion.FechaEvolucion`. `datetime2` de EF usa la precisión predeterminada de SQL Server (7), compatible con el script. **La coincidencia con Azure permanece no verificable.**

| Caso | Evidencia de código/script | Clasificación documental |
|---|---|---|
| `Examen.Resultado` | Propiedad C# existente; `entity.Ignore(e => e.Resultado)`; sin columna en script; sin DTO de lectura ni escritura; prueba `ModeloEfNoPersisteResultadoNiAtribucionDerivada` | C: propiedad C# sin columna documentada; no afirmar B sin Azure |
| `Examen.IdPaciente`, `Examen.IdMedico` | Propiedades C# ignoradas; no columnas en script; derivación desde Consulta/Diagnostico en servicio | C, derivadas correctamente; no nuevas columnas |
| `Diagnostico.IdMedico`, `Tratamiento.IdMedico` | Propiedades ignoradas por EF; atribución por Consulta | C, derivadas; no nuevas columnas |
| `Evolucion.IdPaciente`, `Evolucion.IdMedico` | Propiedades ignoradas por EF; atribución derivada | C, derivadas; no nuevas columnas |
| `AsignacionHabitacion.TipoAsignacion` | Columna y mapeo EF existentes; ausente en `AsignacionHabitacionResponse` | D: persistida sin consumidor conocido en respuesta de esta API; verificar otros usos antes de cambiar |
| Consulta: `Sintomas`, `Observaciones`, `PesoLb`, `PresionSistolica`, `PresionDiastolica`, `AlturaCm` | Expuestos en detalle/creación/actualización; ausentes del DTO de listado | F: decisión de presentación/API, no brecha de columna |
| Consulta: `MotivoConsulta` | Presente en detalle y como propiedad opcional del listado | Ya disponible en API |

Las pruebas actuales de `ExamenesTests` **afirman expresamente** que EF no persiste `Resultado`; cualquier futura habilitación requeriría actualizar esa prueba por cambio de contrato justificado, no eliminarla. `ExamenService.ListarAsync` y `ObtenerAsync` no reciben el usuario autenticado para restringir cada registro; antes de exponer resultados o documentos sensibles hay que definir y probar autorización por paciente/consulta/médico, además del permiso de módulo `Historial/Consultar`.

## H–I. Matriz de columnas específicas

En esta matriz, “existe” se refiere **solo al script**. La columna “Azure” es el estado que pidió la auditoría y permanece `NO VERIFICABLE`. `API` indica la disponibilidad actual conocida, no autorización suficiente para revelar información clínica.

| Tabla | Columnas | Tipo esperado según script | Existe en script | Azure | EF/API | Necesita cambio |
|---|---|---|---|---|---|---|
| Consulta | `IdConsulta`, `IdPaciente`, `IdMedico`, `IdSucursal` | int NOT NULL | Sí | NO VERIFICABLE | EF + DTO | No, si Azure coincide |
| Consulta | `IdClinica` | int NULL | Sí | NO VERIFICABLE | EF + DTO | No |
| Consulta | `FechaConsulta` | datetime2(7) NOT NULL | Sí | NO VERIFICABLE | EF + DTO | No |
| Consulta | `MotivoConsulta`, `Sintomas`, `Observaciones` | nvarchar(300) NULL | Sí | NO VERIFICABLE | EF + DTO; solo motivo en listado | API solo si se necesita listar los otros |
| Consulta | `PesoLb`, `PresionSistolica`, `PresionDiastolica` | float NULL | Sí | NO VERIFICABLE | EF + DTO detalle | No para evaluación básica |
| Consulta | `AlturaCm` | int NULL | Sí | NO VERIFICABLE | EF + DTO detalle | No |
| Consulta | `TemperaturaC` | candidato decimal(4,1) NULL | No | NO VERIFICABLE | No | Solo si requisito demostrado y autorizado |
| Consulta | `FrecuenciaCardiaca` | candidato smallint NULL | No | NO VERIFICABLE | No | Solo si requisito demostrado y autorizado |
| Consulta | `EstadoConsulta` | candidato nvarchar(20) NULL | No | NO VERIFICABLE | No | No recomendada sin estados/transiciones aprobados |
| Examen | `IdExamen`, `IdConsulta`, `IdDiagnostico`, `IdTurno` | int; tres FK nullable | Sí | NO VERIFICABLE | EF + DTO | No |
| Examen | `NombreExamen` | nvarchar(200) NOT NULL | Sí | NO VERIFICABLE | EF + DTO | No |
| Examen | `FechaExamen` | datetime2(7) NOT NULL | Sí | NO VERIFICABLE | EF + DTO | No |
| Examen | `FechaResultado` | date NULL | Sí | NO VERIFICABLE | EF + DTO | No; fecha ≠ contenido |
| Examen | `Prioridad` | nvarchar(20) NULL | Sí | NO VERIFICABLE | EF + DTO | No |
| Examen | `Resultado` | candidato nvarchar(max) NULL | No | NO VERIFICABLE | CLR sí, EF ignorada, DTO no | Nueva columna solo si Azure no la tiene y se exige resultado textual |
| AsignacionHabitacion | `IdAsignacion`, `IdPaciente`, `IdHabitacion` | int NOT NULL | Sí | NO VERIFICABLE | EF + DTO | No |
| AsignacionHabitacion | `FechaIngreso`, `FechaEgreso` | datetime2(7), segunda nullable | Sí | NO VERIFICABLE | EF + DTO | No |
| AsignacionHabitacion | `Observaciones` | nvarchar(300) NULL | Sí | NO VERIFICABLE | EF + DTO | No |
| AsignacionHabitacion | `TipoAsignacion` | nvarchar(20) NOT NULL | Sí | NO VERIFICABLE | EF sí, respuesta no | Solo API si la vista lo requiere |
| AsignacionHabitacion | `IdConsulta` | no prevista | No | NO VERIFICABLE | No | NO RECOMENDADA obligatoria |
| HistorialMedico | `IdHistorial`, `IdConsulta`, `IdDiagnostico`, `FechaHistorial`, `Descripcion` | int PK; int?; int?; datetime2(7); nvarchar(300) | Sí | NO VERIFICABLE | EF con nombres C# distintos + DTO | No |

El script no muestra columnas equivalentes con otro nombre para `TemperaturaC`, `FrecuenciaCardiaca`, `EstadoConsulta`, `Examen.Resultado` o `AsignacionHabitacion.IdConsulta`. Una equivalencia **en Azure** no puede descartarse hasta consultar su catálogo.

## J–M. Alcance del módulo Consultas y propuestas

| Apartado | Soporte documental actual | Categoría | Recomendación |
|---|---|---|---|
| Evaluación | Consulta ya tiene motivo, síntomas, observaciones, peso, presiones y altura | YA DISPONIBLE | Reutilizar. Temperatura y frecuencia solo si el requisito real las exige. |
| Exámenes | Nombre, relaciones, fecha, prioridad y fecha de resultado; falta contenido narrativo en script | REQUIERE NUEVA COLUMNA, SUJETA A AUTORIZACIÓN **solo si Azure confirma ausencia** | `Examen.Resultado nvarchar(max) NULL`; validar longitud/contenido en C#; no equiparar fecha con resultado. |
| Diagnóstico | Tabla con Consulta, descripción y fecha | YA DISPONIBLE | Sin cambio estructural. |
| Tratamiento | Tabla con Consulta, descripción, indicaciones, fechas, lote/cantidad | YA DISPONIBLE | Sin cambio estructural. |
| Evolución | `HistorialMedico` con Consulta opcional, diagnóstico opcional, fecha y descripción | YA DISPONIBLE | Sin cambio estructural; conservar atribución verificable. |
| Hospitalización | Asignación por paciente y habitación con ingreso/egreso | SOLO REQUIERE CAMBIO DE API si se precisa filtro por paciente | No exigir vínculo a Consulta; emergencia puede ingresar antes de consultar. |
| Documentos de examen | Sin columna/tabla documental útil en script | REQUIERE DISEÑO DE ALMACENAMIENTO | Evaluar objetos privados R2 y metadatos persistentes; no reutilizar fotos ni una URL aislada. |
| Estado de consulta | No existe en script | NO RECOMENDADA | Definir primero semántica, transiciones, permisos y necesidad académica. |

**Candidatas únicamente condicionadas, sin autorización de implementación:**

| Tabla/columna | Tipo/null | Finalidad y requisito | EF/DTO/Angular | Registros históricos y riesgo |
|---|---|---|---|---|
| `Examen.Resultado` | `nvarchar(max) NULL` | Contenido textual de resultado, si se aprueba como requisito y Azure confirma ausencia | Quitar `Ignore`, mapear; lectura y operación de actualización explícitas; Angular debe distinguir fecha, texto y archivo | Históricos quedan `NULL`; riesgo alto de exposición clínica y sobrescritura concurrente; exige autorización separada |
| `Consulta.TemperaturaC` | `decimal(4,1) NULL` | Medición vital solo si requisito demostrado | Entidad, mapeo de precisión, DTO y formulario; validar rango y decimal en C# | Históricos `NULL`; riesgo de unidades/precisión; exige autorización separada |
| `Consulta.FrecuenciaCardiaca` | `smallint NULL` | Medición vital solo si requisito demostrado | Entidad, DTO y formulario; validar valor clínico en C# | Históricos `NULL`; riesgo de unidades/rangos; exige autorización separada |

`Consulta.EstadoConsulta` e `IdConsulta` obligatorio en `AsignacionHabitacion` no se proponen. Tampoco se propone estructura nueva en Diagnostico, Tratamiento o HistorialMedico.

Para documentos múltiples, el diseño conceptual sin tabla nueva consiste en un espacio privado R2 por `IdExamen`, claves opacas por documento y un índice persistente de metadatos/versiones en R2, con autenticación y autorización en cada operación, integridad por hash, límites y validación de tipo/tamaño, análisis antimalware, retención y reconciliación ante fallos. Hay que resolver concurrencia y consistencia entre SQL y R2 antes de implementar. La fotografía del paciente y `Paciente.UrlFoto` no son sustitutos. Si estas garantías no pueden demostrarse, la gestión documental queda bloqueada.

## N. Limitaciones de acceso, consultas preparadas y validación

**Consultas remotas ejecutadas: cero. Resultados de Azure SQL: ninguno.** No se ejecutó `sqlcmd` ni el probador de bloqueos. No se puede informar con honestidad de edición/versiones del motor, identidad efectiva, permisos de lectura o coincidencia script–Azure. Se verificó estáticamente el script y el código; no se hicieron pruebas de base de datos.

Con un perfil **específico, autorizado y comprobablemente de solo lectura**, el corte siguiente deberá consultar únicamente catálogos y funciones de metadatos: `DB_NAME()`, `SUSER_SNAME()`, `USER_NAME()`, `SERVERPROPERTY('EngineEdition')`, `SERVERPROPERTY('ProductVersion')`, `HAS_PERMS_BY_NAME(...)`, `sys.schemas`, `sys.tables`, `sys.columns`, `sys.types`, `sys.default_constraints`, `sys.key_constraints`, `sys.index_columns`, `sys.foreign_keys`, `sys.foreign_key_columns` y `sys.check_constraints`. El resultado debe excluir valores de filas clínicas y secretos. Antes de cualquier consulta hay que contrastar nombre de base, servidor y permisos del principal con el destino aprobado; si faltan permisos de visibilidad de metadatos, marcar `NO VERIFICABLE`, no inferir ausencia de columnas.

Para documentación solamente se deben comprobar rutas, referencias, formato y `git diff --check`. No se ejecutaron los tests SQL de ciclo de vida ni `dotnet restore/build` porque no se cambió código.

## O. Recomendación final

Mantener esta auditoría en estado **PARCIAL/BLOQUEADA PARA AZURE** hasta contar con un perfil de lectura autorizado. Tras obtenerlo, completar la matriz con tipos y restricciones reales y recalificar cada columna `EXISTE`, `NO EXISTE`, `EXISTE CON OTRO NOMBRE COMPROBADO` o `NO VERIFICABLE`. Ninguna columna queda autorizada por este informe. No se modificaron API, frontend, Azure SQL, R2, JWT o RBAC; no hubo commit, push ni despliegue.

## DB-AUDIT-AZURE-02 — Preparación de validación remota (22/10/2026)

**Resultado: perfil de auditoría independiente no disponible; inspección remota detenida.** Se revisaron únicamente los nombres de configuración disponibles: la API declara `ConnectionStrings:DefaultConnection` y el almacén local de User Secrets no tiene otra clave de conexión con finalidad de auditoría o solo lectura. Tampoco hay una variable de entorno de conexión/auditoría, un DSN ODBC o Azure CLI configurado para este corte. `sqlcmd` está instalado, pero no es una identidad. No se reutilizó `DefaultConnection`, no se mostraron valores secretos y no se abrió conexión a Azure SQL.

### Procedimiento para el administrador (no realizado aquí)

1. Confirmar fuera de esta tarea el servidor y la base autorizados. Preferir un **principal contenido Microsoft Entra** dedicado a la auditoría, con vigencia acotada. Un usuario SQL contenido y restringido es alternativa si Entra no está disponible. Entregar al auditor solo el nombre del perfil/mecanismo y el destino esperado; custodiar las credenciales fuera del repositorio y del chat. Microsoft documenta la [creación de usuarios contenidos Entra](https://learn.microsoft.com/en-us/azure/azure-sql/database/authentication-aad-configure) y la [visibilidad de metadatos](https://learn.microsoft.com/en-us/sql/relational-databases/security/metadata-visibility-configuration).
2. Limitar el principal a `CONNECT` y `VIEW DEFINITION` en el alcance necesario para las ocho tablas y sus relaciones, sin `SELECT` sobre filas clínicas. Si se concede `VIEW DEFINITION` a nivel de `SCHEMA::dbo`, advertir que revelará metadatos de todo ese esquema; evaluar una concesión por objeto si satisface el inventario. **No** agregarlo a `db_owner`, `db_ddladmin`, `db_datareader` o `db_datawriter`; no conceder `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `CONTROL`, `EXECUTE` ni permisos de creación. `VIEW DEFINITION` permite inspeccionar metadatos sin otorgar por sí mismo lectura de filas; [Microsoft explica los alcances](https://learn.microsoft.com/en-us/sql/t-sql/statements/grant-schema-permissions-transact-sql).
3. Revisar también permisos heredados por otros roles o grupos Entra y acceso indirecto mediante vistas/procedimientos. Registrar una constancia administrativa de que la identidad carece de acceso innecesario a datos clínicos. No guardar contraseñas ni cadenas de conexión completas en `appsettings`, documentos o argumentos visibles del proceso.
4. Comunicar que el perfil está disponible y cómo activarlo localmente sin compartir secretos. Mantenerlo separado de `DefaultConnection`; este informe no configura ni crea perfiles.

### Puerta de seguridad antes de consultar columnas

Con la identidad entregada, ejecutar primero **solo funciones y consultas de metadatos** para registrar `DB_NAME()`, identidad efectiva, `SERVERPROPERTY('EngineEdition')`, `SERVERPROPERTY('ProductVersion')`, esquema visible, `IS_MEMBER('db_owner')`, `IS_MEMBER('db_ddladmin')`, `IS_MEMBER('db_datareader')`, `IS_MEMBER('db_datawriter')` y `HAS_PERMS_BY_NAME` para `VIEW DEFINITION`, `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `ALTER` y `CONTROL` en la base/esquema/objetos pertinentes. `HAS_PERMS_BY_NAME` evalúa permisos efectivos; `IS_MEMBER` comprueba pertenencia a roles, por lo que hacen falta ambas comprobaciones ([permisos efectivos](https://learn.microsoft.com/en-us/sql/t-sql/functions/has-perms-by-name-transact-sql), [roles](https://learn.microsoft.com/en-us/sql/t-sql/functions/is-member-transact-sql)).

La comparación solo puede continuar si la base y la identidad coinciden con la aprobación, la visibilidad de metadatos es suficiente, `SELECT` de tablas clínicas y todos los permisos de escritura/DDL son **0**, y los roles amplios son **0**. Un valor `NULL`, permiso más amplio, acceso indirecto no aclarado o destino inesperado suspende la auditoría. `Application Intent=ReadOnly` por sí solo no sustituye esta comprobación de permisos.

Superada esa puerta, consultar exclusivamente `sys.schemas`, `sys.tables`, `sys.columns`, `sys.types`, `sys.foreign_keys`, `sys.foreign_key_columns`, `sys.default_constraints` y `sys.check_constraints` para las ocho tablas; registrar definición y nulabilidad de las columnas prioritarias `Examen.Resultado`, `Consulta.TemperaturaC`, `Consulta.FrecuenciaCardiaca` y `AsignacionHabitacion.IdConsulta`. Luego cotejar cada fila con el inventario de este informe y el mapeo EF. No ejecutar `SELECT` sobre tablas de pacientes ni historiales. La ausencia de una fila del catálogo con visibilidad insuficiente se clasificará `NO VERIFICABLE`, nunca `NO EXISTE`.

**Evidencia DB-AUDIT-AZURE-02:** consultas remotas ejecutadas: **0**; identidad remota verificada: **ninguna**; cambios administrativos: **0**; escrituras SQL: **0**. Las secciones A–O anteriores continúan siendo documentales. No se autoriza ninguna columna ni cambio de API/Angular mediante esta preparación.
