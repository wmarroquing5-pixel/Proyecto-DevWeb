# WEB-TRAT-01 — Auditoría previa a la implementación

**Estado: bloqueado para implementación del flujo integrado.** No se modificaron archivos funcionales, dependencias, permisos ni datos. La base Azure SQL no se consultó en esta tarea: sigue sin existir un perfil independiente de auditoría de metadatos de solo lectura. Las conclusiones de estructura proceden del `script.sql` del usuario, del mapeo EF Core y de los contratos vigentes; no prueban por sí solas el esquema remoto actual.

## Fuentes y alcance de la evidencia

- `C:\Users\DESARROLLO\Desktop\script.sql`, SHA256 `59AEA7DFC361E81FE865478D24F2750C40F2489F028B5EB5AD40847FD1FF19CB`, secciones `Tratamiento`, `Diagnostico`, `MovimientoInventario`, `LoteMedicamento`, `FacturaDetalle` y restricciones.
- `API-Clinica/Models/Entities/`, `API-Clinica/Data/ClinicaDbContext.cs`, DTO, controladores y servicios de tratamientos, consumo clínico y ventas.
- `WebClinica/src/app/pages/historial/tratamiento-form.component.ts` y `consulta-detalle.component.ts`.
- `DB-AUDIT-AZURE-01/FINAL.md` y `API-Clinica/Docs/API-09B3-consumo-clinico.md` documentan que el esquema remoto del inventario no se ha cotejado mediante una identidad de auditoría.

## Capacidades comprobadas y límites

| Pregunta | Evidencia documental y de código | Resultado |
|---|---|---|
| ¿Un tratamiento admite varios medicamentos? | `Tratamiento` tiene un solo `IdLote` nullable y una sola `Cantidad`; `LoteMedicamento` identifica un medicamento. | **No como una sola entidad Tratamiento.** Varios tratamientos serían registros independientes, sin agrupador de receta. |
| ¿Una prescripción admite varias líneas? | No hay tabla o relación de líneas ni identificador de prescripción en el script; `TratamientoCreateDto` recibe un solo lote. | **No verificable/soportado** por el contrato actual. |
| ¿Se registra la entrega de farmacia? | `Venta`/`VentaDetalle` representan una operación comercial con precio y factura; `MovimientoInventario` no guarda receta, tratamiento ni entrega. | **No** con atribución clínica y cantidades pendientes verificables. Reutilizar una venta alteraría la semántica. |
| ¿Se registra la administración clínica? | No hay entidad, DTO ni endpoint de administración de medicamento; `HistorialMedico` es evolución narrativa y `MovimientoInventario` no identifica administración. | **No** como operación clínica estructurada. |
| ¿Se identifican unidades ya descontadas? | El movimiento conserva `IdMovimiento`, lote, cantidad, usuario, sucursal, tipo y fecha, pero carece de FK a tratamiento, receta, entrega o administración. | **No** puede vincularse inequívocamente la salida con las unidades de una receta/administración. |
| ¿Se registran operaciones parciales? | El POST de consumos acepta cualquier cantidad positiva y produce un movimiento nuevo, sin saldo prescrito ni acumulado atribuible a la receta. | **Solo salidas independientes**, no entregas parciales con saldo verificable. |
| ¿Existe identidad persistente antirrepetición? | `IdMovimiento` se genera **después** de cada descuento; el POST solo recibe `cantidad`. No hay clave de operación ni restricción de unicidad de solicitud. | **No.** Repetir una solicitud con stock disponible puede descontar dos veces. |
| ¿Se rastrea el lote? | `Tratamiento.IdLote` y `MovimientoInventario.IdLote` existen; el tratamiento puede cambiar de lote por PUT tras un consumo. | **Sí por movimiento**, pero no puede reconstruirse con certeza qué tratamiento lo originó. |

`Tratamiento` tampoco tiene `IdDiagnostico`; solo `IdConsulta`. Una consulta puede tener varios diagnósticos y la relación no puede inferirse por fecha, descripción o posición. `Descripcion`/`Indicaciones` (hasta 300 caracteres) no son campos estructurados de dosis, vía, frecuencia y duración. No hay estados persistentes de prescripción, entrega y administración.

El endpoint `POST /api/tratamientos/{id}/consumos` exige `ConsumoClinico/Crear` y médico responsable activo. Usa transacción `Serializable`, bloqueos sobre tratamiento, consulta, medicamento y lote, comprueba vigencia/stock y guarda descuento y movimiento `Uso Interno` juntos. Las pruebas SQL aisladas existentes cubren stock, permisos y concurrencia de **salidas independientes**. No cubren idempotencia por entrega ni administración de unidades previamente entregadas, porque tales operaciones no están modeladas. No debe exponerse este endpoint como entrega de farmacia ni repetirse para registrar una administración ya descontada.

Los permisos `Historial/Crear` y `ConsumoClinico/Crear` tienen propósitos distintos. No hay contratos de entrega o administración con sus permisos y verificaciones de pertenencia. El frontend actualmente registra un tratamiento con un lote opcional y ofrece consumos separados; advierte que cada confirmación crea una nueva salida.

## Decisión de alcance requerida

Con la prohibición de ampliar el esquema y de crear almacenamiento alternativo no autorizado, **no es seguro implementar ni declarar completo WEB-TRAT-01**. Una interfaz que agrupe tratamientos por fecha o codifique identificadores en texto no aportaría integridad referencial, idempotencia ni un historial auditable. Tampoco se deben derivar estados a partir de salidas que no están vinculadas a la receta.

Para avanzar hace falta una decisión explícita sobre el alcance: mantener solo el contrato actual de tratamiento de una línea y consumo clínico como nueva salida independiente, o encargar un diseño separado de persistencia autorizada para recetas, entregas, administraciones y claves de operación. Cualquier propuesta de persistencia deberá demostrar atomicidad con el inventario, autorización, concurrencia, trazabilidad y recuperación; no se implementará dentro de esta tarea sin aprobación. En paralelo, un perfil de metadatos de solo lectura permitiría confirmar si Azure SQL difiere del script.

**Operaciones remotas y cambios:** 0 consultas Azure SQL; 0 escrituras SQL/R2; 0 cambios en API o WebClinica; 0 migraciones, commits, push o despliegues.
