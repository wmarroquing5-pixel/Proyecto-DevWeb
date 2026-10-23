# WEB-TRAT-06B-4 — Plan de aprovisionamiento futuro

**Estado:** plan para revisión, no permiso de ejecución. La base aislada fue creada vacía en 06B-3. En este corte solo se preparan archivos; no se abre conexión SQL. `WEB-TRAT-01` permanece bloqueado.

## Secuencia propuesta, cada puerta con autorización propia

| Puerta | Actividad futura | Identidad / evidencia exigida | Criterio de detención |
|---|---|---|---|
| P0 | Aprobar explícitamente servidor `DESKTOP-QTDJOHF\SQLEXPRESS`, base `ClinicaTratamiento_Aislado_06B`, catorce tablas sintéticas, siete tablas nuevas, identidades y ventana. | Propietario + DBA; especificar qué scripts y pruebas se permiten. | Sin autorización, no ejecutar ni retirar barreras. |
| P1 | Preparar dos grupos Windows separados y verificar su membresía. | Administrador local; sin contraseñas en repositorio. | Grupo inexistente, miembro `sysadmin` o alcance sobre otras bases. |
| P2 | Abrir sesión **solo local** (`lpc:.\SQLEXPRESS`) con base explícita; ejecutar una copia autorizada del precheck de solo lectura. | Máquina, instancia, `EngineEdition=4`, base `ONLINE`, operador exacto, cero tablas/objetos inesperados. | Cualquier diferencia de identidad, destino o catálogo. |
| P3 | Crear logins/usuarios de laboratorio y otorgar `CONNECT`; conceder DDL temporal únicamente a aprovisionamiento. | Una copia aprobada de `IDENTIDADES-PROPUESTAS.sql`; registro de permisos efectivos antes/después. | Privilegios heredados no controlados o acceso fuera de base aislada. |
| P4 | Crear las siete tablas base y siete padres auxiliares aprobados; luego cotejar metadatos. | Copia aprobada de `ESQUEMA-SINTETICO-REVISADO.sql`; hash, revisión DBA, cero datos reales. | FK/tipos diferentes o objetos previos inesperados. |
| P5 | Revocar privilegios DDL temporales del aprovisionador; crear siete tablas clínicas nuevas solo en una autorización posterior separada si se mantiene el diseño. | `DDL-EJECUCION-AISLADA.sql` permanece con barrera; revisar decisiones pendientes de WEB-TRAT-06A. | Equivalencias, estados o integridad no resueltos; no usar el DDL en producción. |
| P6 | Conceder a identidad de pruebas permisos por objeto según casos aprobados; verificar ausencia de DDL y acceso externo. | Lista de `GRANT SELECT/INSERT/UPDATE/DELETE` específica, revisada tras existir objetos. | `db_owner`, `db_ddladmin`, `db_datawriter`, `sysadmin` o permiso amplio inesperado. |
| P7 | Ejecutar pruebas sintéticas estructurales/transaccionales únicamente con autorización expresa. | Scripts de pruebas aún bloqueados; aislamiento de conexiones y ROLLBACK/COMMIT definido. | Cualquier conexión productiva o dato real. |

**No fusionar P3–P7 por comodidad.** Este corte termina antes de P1. La creación de grupos Windows, logins, usuarios, concesiones, revocaciones, tablas y DML requiere autorización posterior que identifique cada operación. El `THROW` inicial de todos los borradores permanece; la futura ejecución debe partir de una **copia nueva** revisada, nunca editar silenciosamente esta evidencia.

## Permisos propuestos y límites

- Aprovisionamiento: `CONNECT` y `VIEW DEFINITION` a la base aislada; `CREATE TABLE` en esa base y `ALTER ON SCHEMA::dbo` solo durante la ventana de creación. `VIEW DEFINITION` evita interpretar un catálogo invisible como vacío. `ALTER` es amplio dentro de `dbo`: requiere vigilancia y revocación. No usar en operación cotidiana.
- Pruebas: `CONNECT` y, después de crear tablas, concesiones por tabla/acción para los casos autorizados. Sin DDL ni roles amplios. Los permisos concretos de DML se definirán cuando los casos y objetos estén cerrados.
- No tocar `dbo.Permiso`, roles clínicos o las 67 asignaciones RBAC. Un login de SQL Express no confiere autorización clínica en la API.
- Confirmar que `public`/`guest` y cualquier grupo Windows anidado no den acceso a otras bases. Probar permisos efectivos bajo cada identidad, no inferirlos de `GRANT` escritos.

## Preparación y trazabilidad

Registrar para cada futura fase: autorización, identidad, transporte `lpc`, `@@SERVERNAME`, propiedades del motor, `DB_NAME`, objetos antes/después, comandos ejecutados y resultado, hashes de scripts, revocación efectiva e incidencias. No registrar secretos ni filas clínicas. El `script.sql` del Escritorio tiene `USE [db_Clinica]`; **solo es referencia documental y nunca se ejecutará** en el laboratorio.

La ausencia de tablas y objetos fue verificada en 06B-3. Es evidencia histórica; P2 debe repetirla antes de cualquier operación. La revisión estática de 06B-4 no demuestra compilación SQL ni funcionamiento de las FK. Las garantías de igualdad consulta–diagnóstico–tratamiento, medicamento–lote, saldos, idempotencia y concurrencia requerirán pruebas futuras y decisiones clínicas/documentales aún pendientes.
