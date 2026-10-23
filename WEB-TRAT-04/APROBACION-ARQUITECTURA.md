# WEB-TRAT-04 — Evaluación arquitectónica para aprobación

**Resultado:** se recomienda estudiar la alternativa B de [`WEB-TRAT-03/DISENO-FINAL.md`](../WEB-TRAT-03/DISENO-FINAL.md) porque la alternativa A no puede demostrar WEB-TRAT-01 completo. **La recomendación no aprueba DDL.** `AGENTS.md` y la skill [`database-contract`](../.agents/skills/database-contract/SKILL.md) mantienen la base inmutable. Ninguna estructura propuesta existe por este documento.

## 1. Evidencia y alcance del modelo

`Tratamiento` actual enlaza consulta y, opcionalmente, un lote/cantidad; no enlaza `IdDiagnostico`. `MovimientoInventario` no enlaza receta/entrega/administración ni contiene clave de solicitud. `FacturaDetalle` es comercial; `HistorialMedico` narrativo. Las verificaciones remotas de esquema citadas en [`DB-AUDIT-AZURE-02/FINAL.md`](../DB-AUDIT-AZURE-02/FINAL.md) fueron realizadas **por el usuario en SSMS** con `aud_empresa`, no por Codex. El conteo de 27 tablas, las 36 columnas y 28 metadatos adicionales no prueban ausencia de todo objeto equivalente con otro nombre o invisible por permisos; ese cotejo queda pendiente. La ausencia de `IX_Bitacora_Tabla_Fecha` en Azure fue confirmada por evidencia SSMS aportada y no se pretende corregirla aquí.

## 2. Revisión de siete estructuras propuestas

| Estructura | Función mínima | Relaciones y control de integridad | Decisión arquitectónica |
|---|---|---|---|
| `RecetaClinica` | Cabecera, diagnóstico, tratamiento, autor, versión e idempotencia. | FK a Tratamiento/Diagnostico/Usuario; ambos clínicos deben ser de la misma Consulta; UNIQUE clave y `(IdTratamiento, NumeroVersion)`; solo una vigente si se aprueba. | Recomendada, pendiente de excepción de esquema y política de versiones. |
| `RecetaLinea` | N medicamentos, pauta y cantidad por receta. | FK a Receta/Medicamento; cantidad/dosis positivas, orden único; unidad de inventario verificada. | Recomendada; **brecha de equivalencias** pendiente (§3). |
| `EntregaFarmacia` | Evento de confirmación con actor/fecha/clave. | FK a receta/usuario; clave UNIQUE; se confirma junto a ≥1 detalle y movimientos. | Recomendada. |
| `EntregaDetalle` | Parcialidad por línea y lote. | FK a Entrega/Linea/Lote; cantidad positiva; misma receta/medicamento y saldo comprobados bajo transacción. | Recomendada. |
| `AdministracionClinica` | Acto con origen directo, entregado o externo. | FK a línea y, según origen, entrega o lote; CHECK exclusivo; clave UNIQUE; sin doble salida. | Recomendada, su política clínica pendiente. |
| `SalidaClinica` | Relación 1:1 global entre nuevo movimiento y entrega o administración directa. | FK `IdMovimiento` UNIQUE, XOR de dos FK de origen, índices únicos filtrados; lote/cantidad/tipo contrastados transaccionalmente. | Recomendada para atribución inequívoca sin cambiar `MovimientoInventario`. |
| `CorreccionClinica` | Rectificación referencial append-only y eventual compensación. | FK al evento original, clave UNIQUE, motivo/actor, movimiento compensatorio único cuando proceda. | Diseño reservado; **operación bloqueada** hasta política de devolución/reintegro. |

La estructura exacta, tipos propuestos, nulabilidad, PK/FK/CHECK/UNIQUE/índices se encuentran en `DISENO-FINAL.md`; ningún `DEFAULT` debe fabricar estados o actos. Las siete tablas son una **propuesta** y requieren revisión DBA del SQL real y de nombres equivalentes. Las seis primeras permitirían núcleo sin correcciones activas; la séptima es necesaria para correcciones auditables completas. No sustituirla por texto en `Bitacora`.

### Integridad que no queda resuelta solo con FK simples

- `RecetaClinica.IdTratamiento` y `IdDiagnostico` deben apuntar a **la misma** consulta; `EntregaDetalle.IdRecetaLinea` debe pertenecer a la receta de `EntregaFarmacia`; `IdLote.IdMedicamento` debe coincidir con `RecetaLinea.IdMedicamento`; `AdministracionClinica.IdEntregaDetalle` debe pertenecer a esa misma línea. La aplicación debe comprobarlo en la misma transacción que inserta, bloqueando filas relevantes.
- Las FK individuales no hacen cumplir estas igualdades para escritores SQL ajenos a la API. Un control puramente relacional requeriría claves compuestas/índices únicos adicionales en tablas existentes o rediseño, que **no está autorizado** por la regla vigente. Por tanto, para prometer integridad completa se debe decidir entre acceso de escritura exclusivo a la API con pruebas de carrera y auditoría, o ampliar explícitamente el alcance de la excepción DDL. No afirmar garantía total antes de esa decisión.
- La existencia de ≥1 `RecetaLinea` por cabecera y ≥1 `EntregaDetalle` por entrega tampoco la garantiza un CHECK de una sola fila; se impone mediante transacción de creación y conciliación. Prohibir escrituras directas fuera del servicio autorizado.
- `Consulta.IdPaciente/IdMedico` y relaciones clínicas referidas deben quedar inmutables para eventos confirmados o tener un mecanismo formal de transferencia/historial. El servicio actual no permite cambiar `Tratamiento.IdConsulta`, pero debe revisarse el resto antes de implementar.

## 3. Brecha de unidad de inventario

`CantidadDisponible` es entera; `Presentacion` existente es texto. El diseño de `RecetaLinea` registra `UnidadInventario`, `UnidadDosis`, `Dosis` y `CantidadPrescritaUnidades`, pero no aporta por sí solo una equivalencia validada y versionada por producto/lote. Recomendación: aprobar una fuente gobernada de equivalencias con presentación/concentración, unidad descontable, factor, fraccionamiento, vigencia, fuente documental y responsable; conservar la instantánea aplicable a cada receta. Puede requerir **ampliar el diseño propuesto dentro de `RecetaLinea` o una fuente externa aprobada**, sujeto a revisión de seguridad, persistencia y excepción de esquema. No usar texto libre ni `Medicamento.Presentacion` como cálculo automático. Hasta resolverlo, restringir el alcance futuro a productos con unidad 1:1 demostrada por farmacia y bloquear los demás. Esta restricción debe quedar visible en los criterios de aceptación.

## 4. Estados, saldos y transacciones

`RecetaClinica.Estado` propuesto: `Vigente`, `Sustituida`, `Anulada`; transiciones controladas según [`APROBACION-FUNCIONAL.md`](APROBACION-FUNCIONAL.md). El saldo `pendiente = prescrito - entregado - administradoDirecto`, con agregados **confirmados y no compensados**, se calcula por línea; administración desde entrega no lo resta otra vez. Entrega y administración son eventos inmutables: `Confirmada/Rectificada` y `Registrada/Rectificada` se derivan del evento correctivo, no de campos mutables de estado. Medicamento externo permanece separado hasta política clínica.

Para cada POST: clave UUID creada antes del envío, hash SHA-256 de payload canónico + método/ruta/ámbito + identidad del actor, UNIQUE persistente por tipo, y resultado recuperable por clave solo para usuario autorizado. Misma clave/hash → mismo evento; diferente hash → `409`; carrera de índices 2601/2627 → releer y comparar. Si el COMMIT se produjo pero se perdió la respuesta, el cliente recupera el evento, no crea otra clave. Un error previo al COMMIT revierte todo.

Entrega: transacción con receta/líneas bloqueadas, saldos calculados, lotes bloqueados en orden estable con ventas/consumo legado, decremento condicionado de `CantidadDisponible`, inserción de cabecera/detalles, `MovimientoInventario` `Uso Interno` y `SalidaClinica`; todo o nada. Administración directa: mismo patrón, una salida. Administración desde entrega: bloquear detalle y agregados de administraciones, sin stock ni movimiento. Externa: sin stock. Ensayar `SERIALIZABLE`/bloqueos equivalentes y deadlocks en SQL Server **aislado**; `LoteMedicamento` CHECK no reemplaza la condición atómica ni la unicidad de operaciones.

Las correcciones con reintegro necesitan retorno físico verificable y movimiento compensatorio en transacción; no se ha aprobado su tipo SQL ni su efecto sobre saldos. Deshabilitar esa operación hasta resolución. El plan condicionado y pruebas están en [`WEB-TRAT-03/PLAN-IMPLEMENTACION.md`](../WEB-TRAT-03/PLAN-IMPLEMENTACION.md).

## 5. Compatibilidad y corte futuro

`POST /api/tratamientos/{id:int}/consumos` sigue vigente solo para históricos: cada llamada es una nueva salida independiente. El futuro guard de API debe rechazarlo para tratamientos con `RecetaClinica` y evitar que `PUT /api/tratamientos/{id}` cambie `IdLote/Cantidad` gestionados. No atribuir movimientos anteriores por coincidencia. Ventas, facturación, JWT y 67 permisos actuales se conservan. Los módulos/DTO/endpoints nuevos de [`WEB-TRAT-03/CONTRATOS-API.md`](../WEB-TRAT-03/CONTRATOS-API.md) siguen conceptuales.

**Puertas antes de aprobar arquitectura para implementación:** excepción formal a inmutabilidad y alcance DDL; cotejo remoto restante; política de unidades y estados; modelo de correcciones; acceso exclusivo de escritura o integridad relacional ampliada; pruebas SQL aisladas de concurrencia e idempotencia; plan de respaldo, reconciliación y reversión. Ninguna está satisfecha por el mero cierre documental de WEB-TRAT-04.
