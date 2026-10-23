# WEB-TRAT-06B-1 — Resultados observados y pendientes

**Corte:** 22/10/2026, America/Guatemala. La autorización actual es **solo de preparación**: `PRECHECK-ENTORNO.sql` y todos los scripts de DDL/pruebas están **sin ejecutar**. Ningún caso estructural o transaccional ha sido ejecutado ni aprobado. Los scripts de escritura conservan `THROW` inicial; el precheck falla cerrado por identidad aún no aprobada.

## Evidencia histórica de lectura, obtenida en el turno anterior

| ID | Objetivo | Resultado observado | Estado |
|---|---|---|---|
| P01 | Resolver instancia local | `DESKTOP-QTDJOHF\SQLEXPRESS`; `EngineEdition=4`, `Express Edition (64-bit)`, versión `17.0.1145.4`. | Verificado por SELECT local. |
| P02 | Identidad y base conectada | `ORIGINAL_LOGIN()=DESKTOP-QTDJOHF\DESARROLLO`; `USER_NAME()=dbo`; base `master`; `IS_SRVROLEMEMBER('sysadmin')=1`. | Verificado; identidad demasiado amplia para batería de aplicación. |
| P03 | Existencia de base aislada exacta | `sys.databases` para `ClinicaTratamiento_Aislado_06B` devolvió **cero filas**. | Verificado: base aún no existe. |
| P04 | Ausencia de datos clínicos reales en base nueva | No evaluable porque la base no existe. Debe aprovisionarse vacía y sintética. | Pendiente. |
| P05 | Ausencia de conexión Azure en aquella comprobación | Comandos Codex dirigidos a `localhost\SQLEXPRESS -d master`; no se usó host Azure. | Alcance de comandos propios; no certifica otros procesos. |

Estos P01–P05 **no son resultados del nuevo script**. En la presente intervención no se abrió conexión ni se ejecutó SQL. La información local deberá reconfirmarse tras autorización de consulta/ejecución posterior.

## Casos estructurales preparados, **no ejecutados**

| ID | Esperado en futura base sintética | Observado | Estado |
|---|---|---|---|
| S01 | Crear siete tablas propuestas tras siete stubs base y cotejo de tipos. | — | Pendiente autorización. |
| S02 | PK/FK/CHECK/UNIQUE/índices coinciden con DDL revisado. | — | Pendiente autorización. |
| I01 | FK rechaza tratamiento inexistente (`547`). | — | No ejecutado. |
| I02 | CHECK rechaza cantidad cero (`547`). | — | No ejecutado. |
| I03 | FK compuesta rechaza línea de otra receta (`547`). | — | No ejecutado. |
| I04 | FK compuesta rechaza detalle de otra línea (`547`). | — | No ejecutado. |
| I05 | CHECK rechaza origen de administración mixto (`547`). | — | No ejecutado. |
| I06 | UNIQUE rechaza UUID repetido (`2601/2627`). | — | No ejecutado. |
| I07 | CHECK revisado rechaza `OrigenAdministracion NULL` (`547`). | — | No ejecutado. |
| I08 | UNIQUE rechaza segundo vínculo del mismo movimiento (`2601/2627`). | — | No ejecutado. |
| I09 | CHECK rechaza estado fuera del conjunto propuesto (`547`). | — | No ejecutado. |
| I10 | Índice filtrado rechaza segunda receta `Vigente` por tratamiento (`2601/2627`). | — | No ejecutado. |
| I11 | Índice filtrado rechaza segunda salida del mismo detalle (`2601/2627`). | — | No ejecutado. |
| I12 | FK compuesta rechaza origen de salida distinto del acto directo (`547`). | — | No ejecutado. |
| I13 | Brecha: lote de medicamento distinto puede pasar FK simples; se documenta, no se acepta como integridad. | — | No ejecutado; requiere ensayo/control C#. |
| T01–T03 | ROLLBACK, COMMIT visible y reversión ante error sin registros parciales. | — | No ejecutados. |
| T04 | Dos sesiones compiten por UUID; una sola confirma. | — | No ejecutado; requiere identidad restringida y coordinación. |
| T05 | Índices/bloqueos relevantes y competencia con ventas/consumo. | — | No ejecutado; parcialmente WEB-TRAT-06B-2. |

**Registro futuro por caso:** servidor/instancia/base/login (sin cadena), UUID de caso sintético, datos sintéticos, SQL exacto y hash, resultado esperado/observado, número de error, filas afectadas, `@@SPID`, transacción y estado final. Ninguna de las celdas «—» representa aprobación.
