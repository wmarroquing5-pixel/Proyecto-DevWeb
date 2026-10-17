# API-08B5 — Decisión sobre idempotencia de ventas y facturas

## Alcance aprobado

El proyecto es una entrega universitaria. Se priorizan los requisitos de *Proyecto Final de Desarrollo Web 2026*. El documento exige registrar ventas, comprobar existencias y descontar los lotes correspondientes (fase 1, requisitos 13.f y 14.a–c). No exige idempotencia persistente de solicitudes HTTP.

En esta entrega no se incorporará una segunda base SQL, Redis ni otro almacenamiento para idempotencia. Tampoco se implementará una deduplicación basada exclusivamente en la igualdad de los datos de dos solicitudes: dos operaciones legítimas pueden tener los mismos datos.

## Comportamiento que se conserva

- `POST /api/ventas` y `POST /api/facturas` mantienen sus contratos REST actuales.
- `VentaService`, `FacturaServiciosService` y `MovimientoSalidaRegistrar` conservan su implementación.
- Se mantienen las transacciones SQL con aislamiento `Serializable`, los bloqueos utilizados para FEFO y las pruebas transaccionales existentes.
- No se crean migraciones ni se modifica el esquema o los datos de Azure SQL como parte de esta decisión.

## Manejo operativo de tiempos de espera

Un timeout o una respuesta HTTP perdida no demuestra que la operación haya fallado. La transacción podría haberse confirmado antes de perderse la respuesta. Por ello, **un POST de venta o factura no debe reintentarse automáticamente después de un timeout sin comprobar primero su resultado**.

La comprobación debe realizarla personal autorizado mediante una consulta de solo lectura o un mecanismo operativo ya disponible, verificando la factura, sus detalles, los movimientos y el stock cuando corresponda. El frontend no debe conectarse directamente a la base de datos. Si no puede determinarse con certeza el resultado, se detiene el reintento y se concilia manualmente; no se presupone que repetir una solicitud con los mismos datos sea seguro.

## Riesgo aceptado y mejora futura

Dos POST válidos, incluso con el mismo contenido, pueden crear dos operaciones distintas. El aislamiento `Serializable` protege la consistencia del inventario, pero no identifica reintentos de una operación ya confirmada. Este riesgo se acepta para el alcance académico actual.

La idempotencia persistente queda como mejora futura, sujeta a un contrato aprobado de identidad de operación, persistencia duradera y manejo de resultados indeterminados. No forma parte de API-08B5 ni se implementa mediante esta nota.

## Siguiente actividad separada

Auditar el cumplimiento del proyecto contra *Proyecto Final de Desarrollo Web 2026* y el código existente, clasificando cada requisito como **Cumplido**, **Parcialmente cumplido**, **Pendiente** o **No verificado**. Priorizar módulos obligatorios, especialmente habitaciones, SignalR, permisos dinámicos, integración y despliegue. Esta actividad no está incluida en el cierre de API-08B5.
