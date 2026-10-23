# WEB-TRAT-06A — Concurrencia, inventario e idempotencia

**Evidencia comprobada:** `ConsumoClinicoService` y `VentaService` usan transacciones `Serializable` y bloqueos SQL (`UPDLOCK, HOLDLOCK`) sobre estructuras existentes; el consumo clínico actual genera un `MovimientoInventario` `Uso Interno` por llamada válida y no tiene clave persistente de idempotencia. `LoteMedicamento.CantidadDisponible` es entero y el `script.sql` documenta CHECK no negativo. El comportamiento del modelo nuevo **no existe todavía**. Metadatos Azure de `DB-AUDIT-AZURE-02/FINAL.md`: evidencia SSMS del usuario, no conexión de Codex.

## Protocolo transaccional propuesto, pendiente de implementación y prueba

| Operación | Bloqueos y escritura atómica | Descuento esperado |
|---|---|---|
| Crear receta | Autorizar médico/consulta/diagnóstico/tratamiento, validar fuente de equivalencia; bloquear adscripciones relevantes y versión; insertar cabecera y ≥1 línea con una clave de operación. | Ninguno. |
| Entrega parcial | Reautorizar; serializar sobre receta/líneas y rango de entregas/administraciones directas; recalcular `pendiente = prescrita − entregada − directa`; bloquear medicamento y lotes en orden global acordado con venta/consumo; validar lote, sucursal, vencimiento, unidad y stock. Insertar cabecera, ≥1 detalle, un movimiento `Uso Interno` y una `SalidaClinica` por detalle junto al decremento condicional `CantidadDisponible >= cantidad`, todo en un COMMIT. | Una vez por detalle confirmado. Nunca más que pendiente ni stock. |
| Administración directa | Serializar saldo de línea; validar lote/producto/unidades; decremento condicionado y evento + movimiento + salida en el mismo COMMIT. | Una vez por acto directo. |
| Administración desde entrega | Bloquear `EntregaDetalle` y rango de actos de ese detalle; exigir `SUM(administrado)+nuevo <= entregado`; insertar solo acto `EntregaPrevia`. | **Ninguno**: ya se descontó al entregar. DDL impide atribuirle `SalidaClinica`. |
| Administración externa | Validar procedencia y política clínica; registrar acto `Externo` sin lote interno, movimiento ni salida. | Ninguno. No reducir pendiente interno sin política expresa. |

La condición de actualización del lote debe comprobar **exactamente una fila afectada**. La operación completa se revierte si falla FK, CHECK, stock, movimiento, vínculo o auditoría. Usar una transacción SQL real, no dos `SaveChanges` autónomos. La política de excepciones de EF y sus `ExecutionStrategy` debe reintentar **la transacción completa con la misma clave**, previa comprobación de resultado confirmado. `SERIALIZABLE` y los índices propuestos son hipótesis a ensayar con planes y carreras en SQL Server Express; no se declara garantía empírica en esta fase. La venta y el consumo legado usan la misma existencia y deben incluirse en las pruebas de carreras. Los flujos nuevos deben bloquear el consumo/PUT legado para tratamientos gestionados antes de permitir escrituras nuevas; no se modifica ahora.

## Clave persistente y recuperación

Cada POST mutador usaría un UUID no vacío generado una vez antes del primer envío y `HashSolicitud binary(32)` calculado sobre representación canónica versionada: método, ruta/recurso, ámbito/receta, actor autorizado, unidades, lote y cuerpo normalizado. El hash se calcula en servidor; no almacenar secretos ni contenido clínico completo dentro de la clave. Los `UNIQUE(ClaveOperacion)` de receta, entrega, administración y corrección evitan duplicados **dentro de cada tipo**; la API debe mantener dominio de claves por tipo o ampliar la política si se exige unicidad global.

1. Antes de mutar, autenticar/autorizar y buscar la clave del tipo. Misma clave y hash: devolver el mismo recurso persistido tras volver a comprobar autorización. Misma clave y hash diferente: conflicto `409`, sin escritura.
2. Dos peticiones simultáneas pueden ver clave ausente. El índice UNIQUE arbitra; ante errores SQL `2601/2627` releer el evento y comparar hash. No iniciar otro descuento al resolver el conflicto.
3. Resultado de COMMIT incierto por corte de red: buscar la **misma** clave en una conexión nueva, comprobar estado del evento y vínculos de salida. Si no existe, reintentar con la misma clave; si existe, devolverlo. No sustituir UUID por uno nuevo.
4. Falla antes de COMMIT: rollback de evento, descuento, movimiento y vínculo. Falla del rollback o estado incierto: suspender reintento automático hasta lectura de reconciliación. No devolver éxito de cabecera huérfana.

## Garantías SQL y de servicio

SQL potencial: FK de existencia, CHECK de origen/cantidades, UNIQUE por evento y movimiento, UNIQUE filtrados de origen. **No** garantiza que cada acto de descuento tenga movimiento, la equivalencia del lote, el saldo agregado ni que un movimiento `Uso Interno` tenga tipo/lote/cantidad/sucursal correctos. Eso requiere servicio transaccional con escritura exclusiva y conciliación. La conciliación informa y bloquea reparaciones automáticas: evento descontado sin salida, salida sin evento, movimiento duplicado, divergencia de cantidades/lote/sucursal, stock negativo, entrega o administración superior al saldo, y movimientos históricos sin atribución (esperados como históricos).

## Pruebas futuras, no ejecutadas

- Entrega vs entrega, entrega vs venta, entrega vs consumo legado, directa vs entrega y dos actos `EntregaPrevia` simultáneos al límite; comprobar una sola operación válida cuando el saldo/stock solo alcanza para una.
- Mismo UUID/mismo cuerpo, mismo UUID/otro cuerpo, carrera con UUID idéntico, timeout antes y después del COMMIT, fallo inyectado tras decremento y tras movimiento, deadlock SQL `1205`, FK inválida y cancelación de solicitud.
- Verificar en cada caso stock, número de eventos/movimientos/salidas, saldos y hash, con datos sintéticos en Express aislado y autorización futura. **Cero pruebas de escritura en WEB-TRAT-06A.**

Correcciones y reintegros continúan bloqueados por D12; no se definió un `TipoMovimiento` compensatorio.
