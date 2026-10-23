# WEB-TRAT-06A — Validación técnica y preparación aislada

**Fecha:** 22/10/2026, America/Guatemala. **Estado:** revisión estática preparada, **no** validación en motor SQL ni autorización de implementación. `WEB-TRAT-01` sigue bloqueado; `WEB-TRAT-06B` no se inició.

## Alcance y procedencia de evidencia

Se revisaron `AGENTS.md`, la skill `database-contract`, `DB-AUDIT-AZURE-02/FINAL.md`, los cinco documentos de `WEB-TRAT-03`, los cinco de `WEB-TRAT-04`, los siete de `WEB-TRAT-05`, `C:\Users\DESARROLLO\Desktop\script.sql` y los mapeos/servicios de tratamiento, consumo, venta e inventario necesarios. El script local y código son evidencia documental; los metadatos remotos del informe DB-AUDIT fueron obtenidos **por el usuario desde SSMS**. Codex no conectó a Azure SQL ni al SQL Server Express local.

## Resultado técnico

1. **Unidades:** `Medicamento.Presentacion` no constituye una equivalencia. Las seis columnas de instantánea de `RecetaLinea` en WEB-TRAT-05 no guardan toda la concentración, factor, reglas de fraccionamiento/redondeo y fuente gobernada. `REVISION-UNIDADES.md` compara A (instantánea ampliada con fuente aprobada) y B (catálogo versionado adicional). Ninguna se eligió; medicamentos ambiguos quedan bloqueados para el futuro flujo.
2. **Integridad:** FK compuestas entre tablas propuestas protegen receta–detalle y línea–administración; un vínculo de salida solo puede referir una administración `InventarioDirecto`. La igualdad de consulta tratamiento–diagnóstico, la de medicamento línea–lote, existencia de hijos y saldos agregados aún necesitan servicio transaccional/escritura exclusiva o una excepción formal para ampliar integridad declarativa. No se presume garantía total.
3. **DDL:** `DDL-REVISADO.sql` conserva siete tablas, el orden de dependencias y el `THROW` inicial. Corrige la aceptación de `OrigenAdministracion NULL` en `CK_SalidaClinica_Origen` causada por `UNKNOWN` en SQL Server. Es una revisión estática: no se compiló ni ejecutó contra motor; estados y correcciones del borrador no son política aprobada.
4. **Inventario:** `CONCURRENCIA-IDEMPOTENCIA.md` especifica transacciones, decremento condicionado, saldos serializados, UUID+hash y recuperación por clave. Las ventas y consumos legados compiten por el mismo stock y requieren pruebas simultáneas. Ninguna propiedad transaccional del flujo nuevo fue comprobada con escritura.
5. **Aislamiento:** `VALIDACION-ENTORNO.md` prepara el rechazo de destinos no locales, Azure y bases distintas de la futura `ClinicaTratamiento_Aislado_*`, y la verificación de edición Express, identidad, datos sintéticos y permisos antes de cualquier ejecución autorizada.

## Entregables

| Archivo | Propósito |
|---|---|
| `REVISION-UNIDADES.md` | Alternativas A/B, unidades, factor y bloqueo clínico. |
| `INTEGRIDAD-RELACIONAL.md` | FK/UNIQUE/CHECK frente a validaciones C#. |
| `REVISION-DDL.md` | Hallazgo y límites de revisión SQL. |
| `DDL-REVISADO.sql` | Borrador de siete tablas con barrera `THROW`. |
| `CONCURRENCIA-IDEMPOTENCIA.md` | Inventario, reintentos, atomicidad y carreras. |
| `VALIDACION-ENTORNO.md` | Preflight de SQL Server Express local futuro. |
| `DECISIONES-PENDIENTES.md` | Aprobaciones clínicas, farmacéuticas, DBA y de entorno. |
| `FINAL.md` | Este cierre documental. |

## Validación y límites

Revisión estática del guard, conteo de tablas, dependencias, referencias, ausencia de credenciales en los ocho archivos, `git diff --check` y estado Git. Los archivos previos de `WEB-TRAT-05` se preservaron; los únicos archivos creados/cambiados en este corte están en `WEB-TRAT-06A/`. No se ejecutaron DDL, SELECT remotos, pruebas de escritura, migraciones, `dotnet restore/build` ni despliegues, pues esta fase es exclusivamente documental. Las pruebas SQL de sintaxis, restricciones, índices y concurrencia quedan para una fase aislada **expresamente autorizada**.

**Puerta de continuación:** resolver las decisiones de `DECISIONES-PENDIENTES.md` y obtener autorización específica para instancia/base SQL Server Express local, alcance de DDL y datos sintéticos antes de WEB-TRAT-06B. Una aprobación documental no autoriza Azure SQL ni retirar el `THROW` de este archivo.
