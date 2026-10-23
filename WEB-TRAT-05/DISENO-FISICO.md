# WEB-TRAT-05 — Diseño físico propuesto

**Estado:** propuesta para revisión, sin autorización de ejecución. Ninguna tabla nueva existe por este documento. `DDL-PROPUESTO.sql` tiene una barrera `THROW` deliberada. `WEB-TRAT-01` permanece bloqueado.

## Evidencia y frontera

- `C:\Users\DESARROLLO\Desktop\script.sql` es referencia documental local, SHA256 `59AEA7DFC361E81FE865478D24F2750C40F2489F028B5EB5AD40847FD1FF19CB`; contiene `USE [db_Clinica]` y **no debe ejecutarse tal cual** en un entorno aislado. `DB-AUDIT-AZURE-02/FINAL.md` distingue sus datos de la evidencia SSMS aportada por el usuario. Codex no consultó Azure SQL en WEB-TRAT-05.
- `Consulta.IdPaciente/IdMedico/IdSucursal`, `Diagnostico.IdConsulta`, `Tratamiento.IdConsulta/IdLote/Cantidad`, `Medicamento.IdMedicamento/Presentacion`, `LoteMedicamento.IdMedicamento/CantidadDisponible` y `MovimientoInventario.IdLote/IdUsuario/IdSucursal/TipoMovimiento/Cantidad` están documentados en script/EF. La auditoría SSMS reportó que `Tratamiento` carece de `IdDiagnostico` y que `MovimientoInventario` carece de origen clínico y clave de idempotencia.
- `script.sql` admite `MovimientoInventario.TipoMovimiento='Uso Interno'` y protege `LoteMedicamento.CantidadDisponible >= 0`. Las longitudes/precisiones remotas restantes y la ausencia exhaustiva de estructuras equivalentes con otros nombres siguen pendientes de cotejo por DBA.

## Relaciones y cardinalidad

```text
Consulta 1 ── N Diagnostico
   │
   └─────── N Tratamiento 1 ── N RecetaClinica (versiones)
                         misma consulta ──┘ │
                           Diagnostico 1 ────┘
RecetaClinica 1 ── N RecetaLinea N ── 1 Medicamento
RecetaClinica 1 ── N EntregaFarmacia 1 ── N EntregaDetalle
RecetaLinea 1 ── N EntregaDetalle N ── 1 LoteMedicamento
RecetaLinea 1 ── N AdministracionClinica
EntregaDetalle 1 ── N AdministracionClinica [EntregaPrevia]
EntregaDetalle o AdministracionClinica[InventarioDirecto] 1 ── 1 SalidaClinica 1 ── 1 MovimientoInventario
Receta/EntregaDetalle/Administracion 1 ── N CorreccionClinica
```

`IdPaciente`, `IdMedico` y `IdConsulta` no se duplican en receta: se derivan de `Tratamiento → Consulta`; `RecetaClinica.IdDiagnostico` debe tener esa misma consulta. La FK individual no garantiza esa igualdad; la API futura debe validarla bajo transacción y excluir escritores SQL paralelos no controlados. El número correlativo visual de diagnóstico nunca reemplaza `IdDiagnostico`.

Entre las tablas **nuevas** sí se proponen FK compuestas: `EntregaDetalle.IdReceta` se repite de manera controlada para exigir que su cabecera y línea pertenezcan a la misma receta; `AdministracionClinica(IdEntregaDetalle,IdRecetaLinea)` exige la misma línea; `SalidaClinica(IdAdministracion,OrigenAdministracion)` solo referencia una administración `InventarioDirecto`. Así el esquema impide enlazar una salida a un acto `EntregaPrevia` y evita el doble descuento **atribuible a ese acto**. Esto no impide escrituras directas no autorizadas al stock/libro existente; el control de acceso y la transacción siguen siendo esenciales.

## Siete tablas y reglas físicas

| Tabla | Identidad, FK y cardinalidad | Restricciones/índices principales | Regla que requiere servicio transaccional |
|---|---|---|---|
| `RecetaClinica` | PK `IdReceta`; FK a tratamiento, diagnóstico, usuario y versión anterior. | Clave idempotente única, `(IdTratamiento,NumeroVersion)` único, una `Vigente` por tratamiento, predecesora única, versión positiva. | Diagnóstico y tratamiento de la misma consulta; médico activo/autorizado; ≥1 línea; versionado sin actividad previa salvo política. |
| `RecetaLinea` | PK `IdRecetaLinea`; FK a receta, medicamento y validador de equivalencia opcional. | Orden único por receta, par `(IdRecetaLinea,IdReceta)` único para FK compuesta, cantidades/dosis/duración positivas, instantánea completa o ausente. | Unidad física verificable; no inferir de `Presentacion`; no dispensar si falta/vence validación. |
| `EntregaFarmacia` | PK `IdEntrega`; FK a receta y usuario. | Clave idempotente única; par `(IdEntrega,IdReceta)` único para FK compuesta; fecha UTC. | Crear ≥1 detalle, salidas y descuentos en el mismo COMMIT. |
| `EntregaDetalle` | PK `IdEntregaDetalle`; `IdReceta` repetido y FK compuestas a entrega/receta y línea/receta; FK a lote. | Cantidad positiva; `(IdEntrega,IdRecetaLinea,IdLote)` único; par `(IdEntregaDetalle,IdRecetaLinea)` único. | Lote del medicamento, saldo pendiente y stock suficientes. |
| `AdministracionClinica` | PK `IdAdministracion`; FK a línea/usuario, FK compuesta al detalle de esa línea o FK a lote. | Origen exclusivo `InventarioDirecto`, `EntregaPrevia`, `Externo`; clave y par `(IdAdministracion,Origen)` únicos. | Cantidad administrada desde detalle ≤ entregada; no crear movimiento para `EntregaPrevia`. |
| `SalidaClinica` | PK `IdSalidaClinica`; FK a movimiento, detalle o FK compuesta a administración directa. | `IdMovimiento` único; origen único filtrado; `OrigenAdministracion` fijo `InventarioDirecto` si referencia acto. | Movimiento `Uso Interno`, lote/cantidad/sucursal correctos; directo exige salida en la transacción. |
| `CorreccionClinica` | PK `IdCorreccion`; FK a un objetivo, usuario y movimiento compensatorio opcional. | Objetivo XOR, clave única, motivo y cantidad válidos, movimiento compensatorio único. | Deshabilitar correcciones con stock hasta aprobar retorno físico, tipo de movimiento, saldos y doble control. |

Todas las FK propuestas usan el comportamiento implícito `NO ACTION`; ningún `ON DELETE CASCADE`. No hay `DEFAULT` de estado, actor, lote, cantidad ni fecha de acto. Se proponen `datetime2(3)` UTC, `int IDENTITY` y claves UUID más SHA-256 (`binary(32)`). La API debe crear cabecera y al menos una línea/detalle en una sola transacción; SQL Server no lo puede exigir con un CHECK de fila. El DDL no toca ninguna tabla existente.

## Unidades: ajuste frente a WEB-TRAT-03/04

WEB-TRAT-03 proponía `UnidadInventario`, `UnidadDosis` y cantidad entera, pero no conservaba el origen verificable de la conversión. WEB-TRAT-04 identificó esa brecha. El DDL de revisión añade **columnas dentro de `RecetaLinea`**, no una octava tabla: `ContenidoPorUnidad`, `UnidadContenido`, `FuenteEquivalencia`, `VersionEquivalencia`, `IdUsuarioValidador`, `FechaValidacionUtc`. Son una instantánea propuesta, no una fuente maestra aprobada. La política farmacéutica debe validar presentación, concentración y unidad por medicamento **y lote**; la API debe comprobar que la instantánea coincide con esa fuente vigente. Ninguna conversión se obtiene del texto `Medicamento.Presentacion`.

Regla de habilitación propuesta: si no existe fuente aprobada y equivalencia verificable, **bloquear** receta/entrega/administración del producto en el nuevo flujo. Incluso un supuesto 1:1 necesita constancia farmacéutica; `NULL` en la instantánea no significa 1:1. `CantidadPrescritaUnidades`, `CantidadEntregadaUnidades` y `CantidadUnidades` son enteros en la unidad descontable del lote. `Dosis` y `DosisAplicada` son magnitudes clínicas separadas; factor, redondeo, fraccionamiento y máximo por acto necesitan aprobación clínica. La instantánea no resuelve por sí sola cambios de concentración entre lotes: la validación del lote en cada salida sigue siendo obligatoria.

**Decisión solicitada D-U1:** aprobar estas seis columnas de instantánea y una fuente gobernada externa/versionada, o autorizar una estructura adicional de equivalencias. No se añadió una octava tabla automáticamente. Hasta D-U1, el DDL es revisable pero el flujo farmacológico general no está listo para implementación.

## Inventario, idempotencia y concurrencia propuestos

1. **Receta:** validar consulta, diagnóstico, tratamiento, médico, estado y equivalencias; insertar cabecera+líneas con `ClaveOperacion`/`HashSolicitud` en una transacción. No actualizar lote ni insertar movimiento.
2. **Entrega:** autenticar y autorizar; buscar clave existente y comparar hash. Bajo `SERIALIZABLE`, bloquear receta y líneas en orden, sumar entregas confirmadas, bloquear medicamento y lotes en orden de ID compartido con venta/consumo legado, validar fecha/sucursal/unidades y decrementar stock con condición `CantidadDisponible >= cantidad`. Insertar cabecera, detalles, un `MovimientoInventario('Uso Interno')` y un `SalidaClinica` por detalle; COMMIT único. Si falla cualquier paso, ROLLBACK completo.
3. **Administración directa:** mismo control de saldo/stock y un movimiento+salida. **Desde entrega:** bloquear detalle y actos previos, validar saldo no administrado, registrar acto sin movimiento ni decremento. **Externo:** acto sin lote interno ni movimiento; no reducir pendiente interno hasta decisión clínica.
4. UUID + hash canónico (método, ruta, ámbito, actor y payload normalizado) se guardan en el evento. Misma clave/hash, tras reautorizar, recupera el evento; clave con hash distinto: `409`. Ante error SQL 2601/2627, releer y comparar; ante resultado de COMMIT incierto, consultar por la **misma clave**. No repetir con clave nueva para “arreglar” un timeout.
5. `pendiente = prescrito − entregado − administradoDirecto` sobre eventos confirmados no compensados. `EntregaPrevia` no resta pendiente otra vez. Las correcciones quedan deshabilitadas hasta aprobar su semántica; por ahora los eventos son inmutables y el saldo no aplica compensaciones.

Los índices propuestos facilitan bloqueos por receta/línea/entrega, pero se deben comprobar planes, deadlocks y rangos bajo SQL Server Express aislado. `CHECK CantidadDisponible >= 0` es última defensa, no sustituye el `UPDATE ... WHERE CantidadDisponible >= @cantidad` y la verificación de filas afectadas. Ninguna garantía transaccional se declara probada en esta fase.
