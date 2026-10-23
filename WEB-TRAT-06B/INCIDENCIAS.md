# WEB-TRAT-06B-1 — Incidencias y bloqueos

| ID | Hallazgo | Impacto | Acción / estado |
|---|---|---|---|
| B01 | La autorización actual es **solo documental**; prohíbe abrir conexión o ejecutar el nuevo precheck, DDL y DML. | Impide declarar pruebas reales aprobadas. | Scripts de escritura preparados con `THROW`; precheck falla cerrado por identidad pendiente. |
| B02 | `ClinicaTratamiento_Aislado_06B` no existía según el SELECT local del **turno anterior**. | No se puede verificar ausencia de datos reales, permisos de la base ni ejecutar pruebas. | Reconfirmar tras nueva autorización; base nueva vacía, nunca restauración productiva. |
| B03 | Identidad Windows `DESKTOP-QTDJOHF\DESARROLLO` figuró como `sysadmin` en el SELECT del turno anterior. | Privilegio excesivo para la batería de aplicación; puede saltarse límites administrativos. | DBA designa identidad separada y restringida de prueba; aprovisionamiento inicial controlado por separado. |
| B04 | `WEB-TRAT-06A/DDL-REVISADO.sql` es un borrador de siete tablas con `THROW`; las equivalencias, estados y correcciones siguen pendientes de aprobación. | Un DDL estructural exitoso no habilitaría el flujo clínico. | No retirar barrera ni declarar políticas aprobadas. |
| B05 | El esquema mínimo de `ESQUEMA-AISLADO.sql` reproduce solo tipos/PK/FK relevantes, no todas las columnas y reglas del esquema clínico. | Pruebas de FK nuevas no equivalen a compatibilidad completa de API ni de producción. | Cotejar tipos/longitudes/índices reales con DBA; no usar para migraciones ni datos clínicos. |
| B06 | FK simples no aseguran misma consulta entre tratamiento/diagnóstico ni mismo medicamento entre línea/lote. | Una inserción cruzada podría ser aceptada por SQL. | Registrar como límite; exige validación transaccional C# y control de escritores antes de implementar. |
| B07 | La primera llamada SELECT a `localhost\SQLEXPRESS` agotó tiempo en sandbox; la repetición autorizada fuera de sandbox respondió. `Get-Service` no pudo leer Service Control Manager. | No altera los datos SQL observados; servicio verificado mediante SELECT efectivo. | No inferir que la instancia está ausente por el primer fallo. |
| B08 | `DDL-EJECUCION-AISLADA.sql` contiene ahora las siete tablas como **propuesta completa**, pero conserva `THROW` inicial y marcador de identidad que falla cerrado. | No es una copia autorizada para ejecución. | Revisar con DBA y obtener autorización nueva antes de preparar otra copia ejecutable; preservar fuente WEB-TRAT-06A. |

En la presente intervención no se abrió conexión ni se ejecutó SQL. No se detectaron cambios en API/WebClinica. Los resultados de seguridad y estructura reales permanecen pendientes.
