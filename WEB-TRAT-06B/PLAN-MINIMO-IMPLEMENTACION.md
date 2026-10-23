# WEB-TRAT-C — Orden mínimo de implementación futura

**Estado:** plan, sin ejecución. Seis tablas nuevas solo como propuesta para `DESKTOP-QTDJOHF\SQLEXPRESS` / `ClinicaTratamiento_Aislado_06B`. Ni la creación de objetos locales ni la programación de API/WebClinica están autorizadas por WEB-TRAT-C. Azure SQL sigue inmutable y `WEB-TRAT-01` bloqueado.

| Orden | Corte futuro | Resultado verificable / puerta de salida |
|---:|---|---|
| 0 | Resolver y aprobar reglas clínicas, farmacéuticas y de seguridad | Unidades y equivalencias con fuente verificable; estados/transiciones; roles por operación; política de escritura exclusiva e integridad cruzada. Producto sin equivalencia aprobada queda bloqueado. Correcciones y devoluciones excluidas. |
| 1 | Aprobar laboratorio SQL Express por identidad, base, scripts y casos | Repetir precheck de máquina/instancia/edición/base/identidad y catálogo; crear identidades restringidas y esquema sintético solo mediante autorizaciones específicas. Los borradores conservan su `THROW`. |
| 2 | Validar DDL de seis tablas en laboratorio sintético | DBA revisa `DDL-ALTERNATIVA-C.sql`, prepara una copia ejecutable autorizada y verifica seis tablas, FK, CHECK, UNIQUE, índices filtrados y ausencia de `CorreccionClinica`. No usar `script.sql` productivo ni datos reales. |
| 3 | Validar persistencia y concurrencia aisladas | Pruebas de receta multilínea, parcialidad, administración directa/entrega previa/externa, idempotencia, stock, rollback, carreras con otros escritores y recuperación. Fallos bloquean el paso a código funcional. |
| 4 | Backend: lectura y contratos mínimos | Entidades/EF solo para esquema aprobado del entorno de prueba; DTO y consultas paginadas por ámbito, permisos explícitos, vínculo consulta–diagnóstico–tratamiento y compatibilidad de históricos. No exponer corrección. |
| 5 | Backend: prescripción | Validar médico responsable, consulta/diagnóstico/tratamiento, unidades aprobadas y al menos una línea; guardar receta y líneas de forma atómica e idempotente. Crear receta no descuenta inventario. |
| 6 | Backend: entrega de farmacia | Autorizar farmacéutico y sucursal; bloquear saldos/lotes, confirmar cabecera/detalles, un movimiento y `SalidaClinica` por detalle en un commit; permitir parcialidad sin superar pendiente y resolver reintentos por clave/hash. |
| 7 | Backend: administración clínica | Autorizar profesional; `EntregaPrevia` no descuenta, `InventarioDirecto` descuenta una sola vez, `Externo` no crea salida. Validar cantidad administrada, lote, dosis y origen; transacción/idempotencia. |
| 8 | Compatibilidad con inventario y legado | Guardar tratamientos nuevos frente a PUT/consumo legado que duplicaría salidas; coordinar bloqueo con ventas, facturas y ajustes. Reconciliar saldos y movimientos. No reescribir tratamientos ni movimientos históricos. |
| 9 | Angular: prescripción y seguimiento | Formularios de receta/líneas y lectura de estado, pendientes y eventos; permisos/errores reales; sin conversión inferida de `Presentacion`. |
| 10 | Angular: entrega y administración | Pantallas separadas por función, confirmación explícita, parciales, origen de administración, reintentos idempotentes, estados de carga/conflicto; no ofrecer corrección, devolución ni reintegro. |
| 11 | Regresión y decisión de despliegue | Pruebas .NET/Angular, seguridad por recurso, E2E sintético, reconciliación y revisión DBA. Cualquier destino distinto del Express aislado requiere nueva decisión sobre la restricción de Azure SQL, objetos y operación permitida. |

## Contratos mínimos a definir antes de programar

- Receta: crear una cabecera con varias líneas y clave de operación; consultar por consulta/tratamiento con orden estable; no reutilizar `Tratamiento.IdLote` como una línea múltiple.
- Entrega: confirmar una entrega con detalles por línea/lote y clave de operación; consultar cantidad entregada y pendiente calculadas desde eventos confirmados, nunca desde texto libre.
- Administración: registrar línea, origen, cantidad y dosis con clave de operación; para `EntregaPrevia` referenciar detalle entregado; para `InventarioDirecto` referenciar lote; para `Externo` no referenciar lote ni salida de inventario.
- Cada operación debe validar JWT, permiso específico y pertenencia real del recurso en C#. Respuestas a clave repetida con el mismo hash deben reutilizar el resultado confirmado; hash diferente debe producir conflicto. No existe aún contrato REST aprobado para corrección.

## Casos de aceptación del corte C

1. Una receta con dos medicamentos no altera `CantidadDisponible` ni crea `MovimientoInventario`.
2. Dos entregas parciales no superan lo prescrito; cada detalle confirmado produce una salida vinculada y una única reducción del lote.
3. La administración de una entrega previa no descuenta de nuevo; la directa descuenta una vez; la externa no descuenta.
4. Reintentos, tiempos de espera posteriores al commit y solicitudes concurrentes no duplican entrega, administración, movimiento o descuento.
5. Stock insuficiente, lote vencido, medicamento no coincidente, unidad no aprobada, consulta ajena o permiso insuficiente no dejan registros parciales.
6. Ventas, facturas, consumo legado e históricos conservan su comportamiento; un tratamiento con receta no puede consumir por el camino legado.
7. No existen acciones de corrección, devolución, reintegro ni sustitución con suministro en API o interfaz del primer corte.

`WEB-TRAT-06B/RESULTADOS-PRUEBAS.md` sigue registrando pruebas **pendientes**, y los scripts de pruebas de siete tablas son antecedentes. Ningún caso de esta lista se declara ejecutado o aprobado.
