# WEB-TRAT-C — Impacto arquitectónico de seis tablas

**Decisión del propietario:** el primer corte propone `RecetaClinica`, `RecetaLinea`, `EntregaFarmacia`, `EntregaDetalle`, `AdministracionClinica` y `SalidaClinica`. `CorreccionClinica`, devoluciones, reintegros y rectificaciones avanzadas quedan fuera. Esta decisión autoriza documentación y un DDL protegido para pruebas futuras **solo en SQL Server Express aislado**; no autoriza crear objetos, modificar Azure SQL, implementar API/Angular ni asignar permisos. `WEB-TRAT-01` permanece bloqueado.

## Diferencia frente al diseño de siete tablas

| Aspecto | Diseño histórico de siete | Alternativa C inicial |
|---|---|---|
| Estructuras nuevas | Seis tablas operativas más `CorreccionClinica`. | Solo las seis tablas operativas. El DDL anterior permanece intacto. |
| Dependencias | `CorreccionClinica` referencia receta, detalle de entrega, administración, usuario y movimiento compensatorio. | Se retiran únicamente esa tabla, sus cinco FK, CHECK, UNIQUE e índices propios. Ninguna de las seis tablas conserva FK hacia ella. |
| Trazabilidad | Eventos de prescripción, entrega, administración, salida y propuesta de rectificación. | Se conservan eventos originales y su origen de inventario; **no** existe evento persistente para corregirlos. No fingir una rectificación en `Bitacora`, `Observaciones` o campos de texto. |
| Operaciones permitidas en un corte futuro | Corrección seguía bloqueada por política D12. | No habrá contrato ni servicio de corrección, devolución, reintegro o compensación. Una operación confirmada no se elimina ni se altera para simular reversión. |

La matriz de siete tablas de `MATRIZ-DEPENDENCIAS.md`, el DDL de `WEB-TRAT-06A` y `DDL-EJECUCION-AISLADA.sql` son antecedentes, no instrucciones para ejecutar siete tablas. `DDL-ALTERNATIVA-C.sql` es una copia derivada nueva. El esquema sintético de catorce tablas base/auxiliares no cambia: las seis tablas siguen necesitando `Tratamiento`, `Diagnostico`, `Usuario`, `Medicamento`, `LoteMedicamento` y `MovimientoInventario`, más los padres indirectos documentados. Ninguna tabla adicional se agrega en este corte.

## Integridad conservada y límites reales

| Regla | Soporte en las seis tablas | Verificación pendiente |
|---|---|---|
| Receta y líneas; entrega parcial por línea/lote | FK, FK compuestas, UNIQUE por orden y detalle, CHECK de cantidades positivas. | Al menos una línea/detalle, saldo pendiente y coincidencia de medicamento entre línea y lote requieren transacción y pruebas. |
| Origen de administración | `CHECK` excluyente: `InventarioDirecto`, `EntregaPrevia` o `Externo`; FK de entrega previa con la misma línea. | Suma administrada contra cantidad entregada, dosis y equivalencia farmacéutica requieren reglas aprobadas. |
| Un solo descuento por evento | `SalidaClinica` vincula de forma única el movimiento con entrega o administración directa. Una administración de entrega previa y un medicamento externo carecen de salida nueva. | El servicio debe confirmar stock, movimiento y vínculo en un solo commit; reconciliar con escritores existentes. El DDL por sí solo no impide todas las escrituras ajenas. |
| Reintentos | `ClaveOperacion` UNIQUE y `HashSolicitud` en receta, entrega y administración; UNIQUE de origen en `SalidaClinica`. | Definir alcance de claves por actor/operación, respuesta al mismo hash y conflicto al hash distinto; probar timeout posterior al commit y carreras. La unicidad no es global entre tipos de operación. |
| Inventario no negativo | `LoteMedicamento.CantidadDisponible` y reglas del esquema base sintético. | Bloqueos y orden compatibles con ventas/facturas/consumo; pruebas simultáneas. |

`RecetaClinica` conserva los campos `IdRecetaAnterior`, `NumeroVersion` y el CHECK de estados `Vigente`, `Sustituida`, `Anulada` porque retirar `CorreccionClinica` no exige cambiar las seis definiciones históricas. **Esos valores no aprueban transiciones clínicas.** En el primer corte, sustitución o anulación de una receta con actividad, rectificación de entrega/administración y cualquier reintegro quedan bloqueados. Si la política decide permitir alguna transición limitada sin actividad, requiere aprobación clínica explícita, contrato y pruebas separados.

La instantánea opcional de equivalencia en `RecetaLinea` tampoco aprueba unidades, concentración, factor, fraccionamiento ni redondeo. Sin fuente verificable y validación farmacéutica, bloquear prescripción/dispensación del medicamento en el flujo nuevo. La igualdad consulta–diagnóstico–tratamiento y medicamento–lote no queda garantizada íntegramente por las FK actuales; necesita control transaccional y política sobre todos los escritores, conforme a `WEB-TRAT-06A/INTEGRIDAD-RELACIONAL.md`.

## Impacto en servicios y contratos futuros; ningún cambio ahora

| Área actual | Evidencia de código | Cambio mínimo a diseñar antes de implementar |
|---|---|---|
| `TratamientoService` | Crea y modifica `Tratamiento` legado con `IdLote`/`Cantidad`; no hay relación persistente propia con diagnóstico. | Mantener históricos; distinguir tratamientos gestionados por receta y bloquear PUT que altere un tratamiento con eventos nuevos. No reinterpretar registros antiguos como recetas. |
| `ConsumoClinicoService` | `POST /api/tratamientos/{id}/consumos` descuenta lote y registra `Uso Interno` por solicitud, sin clave persistente de idempotencia clínica. | Evitar que el endpoint legado descuente un tratamiento gestionado por receta. Administración de entrega previa nunca llama a este consumo; administración directa usa la operación nueva idempotente. No cambiar el endpoint en esta fase. |
| `VentaService` y `FacturaServiciosService` | Pueden descontar lotes y registrar movimientos; `VentaService` usa transacción y bloqueo de lotes. | Mantenerlos operativos; acordar orden de bloqueos y concurrencia sobre el mismo lote. No usar venta/factura para representar entrega clínica. |
| `LoteMedicamentoService` y `MovimientoSalidaRegistrar` | Ajustes/entradas y salidas comparten `LoteMedicamento`/`MovimientoInventario`. | Conciliar cada salida clínica con un único `IdMovimiento`; impedir stock negativo y escrituras paralelas inconsistentes. |
| Autorización | Los permisos clínicos actuales no equivalen automáticamente a prescribir, entregar o administrar. | Diseñar permisos separados y validación por consulta, profesional, sucursal y recurso. No modificar las 67 asignaciones existentes por inferencia. |

## Ajuste del plan de pruebas

Se mantienen para una futura fase **autorizada** las pruebas sintéticas de FK/CHECK/UNIQUE e índices filtrados de las seis tablas, receta multilínea, entregas parciales, tres orígenes de administración, una salida por evento, cero descuento al prescribir, reintentos con hash igual/distinto, commit/rollback, timeout tras commit, stock insuficiente, carreras con venta/consumo y compatibilidad de históricos. Los casos de `CorreccionClinica`, devolución, reintegro, movimiento compensatorio y sustitución tras suministro salen del criterio de aceptación inicial y permanecen **bloqueados**, no se marcan aprobados. Los scripts históricos de siete tablas y sus pruebas no se editan ni ejecutan; antes de probar C habrá que preparar una batería derivada de seis tablas con autorización específica.

## Riesgos y decisiones aún abiertas

1. Equivalencia farmacéutica D-U1: fuente, unidad física, concentración, factor y aprobación por medicamento/lote.
2. Integridad cruzada I1: aislamiento de escritores, igualdad entre consulta/diagnóstico/tratamiento y medicamento/lote, conciliación de movimientos.
3. Estados E1: significado y transiciones, consulta cerrada/NULL, versiones y saldos entre versiones. Hasta aprobarlos, bloquear sustitución y anulación con actividad.
4. Permisos P1: prescripción, farmacia, enfermería y lectura por ámbito; no hay asignación aprobada.
5. Cotejo DBA y pruebas T1/S1: sintaxis, índices filtrados, planes, bloqueos y metadatos del Express aislado. Ninguna prueba SQL se ejecutó en WEB-TRAT-C.
6. Política D12 de rectificaciones/devoluciones: queda fuera del corte y exige nuevo diseño persistente y autorización si se retoma.

La alternativa C reduce el alcance inicial, pero **no** constituye autorización para modificar el esquema productivo. El contrato `AGENTS.md` mantiene Azure SQL inmutable; cualquier excepción futura tendría que resolverse expresamente y por separado.
