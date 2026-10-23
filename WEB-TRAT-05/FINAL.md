# WEB-TRAT-05 — Cierre del diseño y preparación aislada

**Estado:** siete entregables preparados para revisión técnica. **No ejecutado, no aprobado para implementación.** `WEB-TRAT-01` continúa bloqueado.

## Entregables

| Archivo | Contenido |
|---|---|
| [`DISENO-FISICO.md`](DISENO-FISICO.md) | Siete tablas, relaciones, unidades, inventario, idempotencia y límites. |
| [`DDL-PROPUESTO.sql`](DDL-PROPUESTO.sql) | SQL Server de revisión con barrera `THROW`; sin `USE`, DML, cambios a tablas existentes ni migración. |
| [`MATRIZ-INTEGRIDAD.md`](MATRIZ-INTEGRIDAD.md) | Invariantes cubiertas por FK/CHECK/UNIQUE frente a las que exigen servicio transaccional. |
| [`PLAN-PRUEBAS.md`](PLAN-PRUEBAS.md) | 22 escenarios sintéticos, concurrencia, fallos e idempotencia para SQL Server Express local. |
| [`CONFIGURACION-AISLADA.md`](CONFIGURACION-AISLADA.md) | Perfil previsto, preflight de solo lectura y regla de abortar antes de escritura. |
| [`COMPATIBILIDAD.md`](COMPATIBILIDAD.md) | Legados, diferencias frente a WEB-TRAT-03/04 y decisiones pendientes. |
| `FINAL.md` | Alcance y estado del corte. |

## Evidencia y hallazgo

Se cotejaron `AGENTS.md`, `database-contract`, WEB-TRAT-02/03/04, `DB-AUDIT-AZURE-02/FINAL.md`, `C:\Users\DESARROLLO\Desktop\script.sql` (SHA256 `59AEA7DFC361E81FE865478D24F2750C40F2489F028B5EB5AD40847FD1FF19CB`) y los servicios/entidades pertinentes. El script es documental; las verificaciones de Azure citadas fueron hechas por el usuario desde SSMS, no por Codex en esta fase. `Tratamiento` no persiste un diagnóstico específico ni receta multilínea; `MovimientoInventario` no persiste el origen clínico ni clave idempotente. `FacturaDetalle` e `HistorialMedico` no suplen esa relación.

La cadena propuesta `RecetaClinica → RecetaLinea → EntregaDetalle/AdministracionClinica → SalidaClinica → MovimientoInventario` distingue una entrega de la administración posterior. FK compuestas entre tablas propuestas impiden enlazar una salida con una administración `EntregaPrevia`. **Entregar** descuenta una vez; **administrar desde entrega** registra el acto sin nueva salida; **administrar directamente** descuenta una vez; **externo** no afecta el stock interno. Cada mutación propuesta lleva clave UUID/hash únicos y transacción completa. Estas son reglas de diseño, no comportamiento desplegado o probado en SQL.

## Ajuste y bloqueo principal

El modelo de siete tablas de WEB-TRAT-03 carecía de evidencia persistente de equivalencia entre dosis y unidades de lote. El DDL propone una instantánea de seis columnas en `RecetaLinea`, sin añadir automáticamente una octava tabla. **D-U1 requiere aprobación farmacéutica, clínica y arquitectónica** de esa instantánea y de una fuente gobernada por producto/lote, o aprobación expresa de una estructura alternativa. Hasta entonces, un medicamento sin equivalencia verificada permanece bloqueado en el nuevo flujo. `Medicamento.Presentacion` textual nunca es factor de conversión.

También faltan política de estados/cierre, corrección y reintegro, asignación de permisos, decisión sobre escritores SQL externos, cotejo de metadatos remotos restantes y ensayos de concurrencia reales en SQL Server Express. `CorreccionClinica` está en el diseño pero su operación continúa inhabilitada. No se promete integridad global solo con FK simples.

## Validación de esta fase

Se comprobaron las siete rutas y los enlaces relativos, los siete `CREATE TABLE` propuestos, la barrera `THROW` como primera instrucción, la ausencia de lotes `GO`, credenciales y espacios finales. `git diff --check` terminó correctamente; los siete archivos nuevos permanecen sin versionar, por lo que se inspeccionaron además de forma estática. `sqlcmd` está instalado, pero **no se invocó**; el motor SQL no validó ni ejecutó el DDL. La disponibilidad de una instancia Express local no pudo confirmarse en esta fase. **Conexiones SQL, DDL aplicado, pruebas de escritura, cambios a Azure SQL, API-Clinica, WebClinica, RBAC, datos productivos y despliegues: ninguno.**

## Siguiente autorización requerida

Para **WEB-TRAT-06**, el propietario y DBA deben autorizar expresamente: instancia SQL Server Express local, nombre exacto de base aislada, datos exclusivamente sintéticos, copia revisada del esquema base, versión ejecutable del DDL con hash, identidad de prueba y límites de ejecución. Deben resolver D-U1 antes de probar conversión farmacéutica; las pruebas de corrección/reintegro seguirán fuera de alcance hasta política clínica. Esta solicitud de autorización **no** incluye Azure SQL ni implementación de API/WebClinica.
