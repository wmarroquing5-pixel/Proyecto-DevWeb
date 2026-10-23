# WEB-TRAT-05 — Plan de pruebas en SQL Server Express aislado

**Estado:** casos preparados, **ninguno ejecutado**. WEB-TRAT-06 solo podrá iniciar tras autorización expresa del entorno, revisión del DDL y decisiones funcionales aplicables. No usar Azure SQL ni copias con filas clínicas reales.

## Preparación y puerta de seguridad

1. Instancia prevista: SQL Server Express **local**; base nueva con prefijo `ClinicaTratamiento_Aislado_` y sufijo aleatorio. Ningún nombre `db_Clinica` ni servidor `*.database.windows.net` es aceptable. Cuenta de pruebas restringida a esa base. Validar `CONFIGURACION-AISLADA.md` antes de abrir una transacción.
2. Crear solo en una fase posterior, con autorización, un esquema sintético mínimo compatible con las FK existentes. `script.sql` contiene `USE [db_Clinica]`: no ejecutarlo literalmente; preparar copia revisada que sustituya el contexto por la base aislada y quite cualquier instrucción no necesaria. Revisar SHA256 y diff de esa copia. No cargar pacientes reales ni restaurar producción.
3. Revisar por DBA la instantánea de unidades de `RecetaLinea`, los valores de estado/CHECK y la matriz de permisos. Mantener **inhabilitadas** las pruebas que requieran corrección/reintegro o conversión no aprobada.
4. Solo tras permiso de WEB-TRAT-06, retirar la barrera `THROW` de una copia del DDL, aplicar a la base aislada, comparar `sys.tables/columns/foreign_keys/indexes/check_constraints` con el diseño y registrar scripts/hashes. No conectar el binario de API de producción.

## Datos sintéticos mínimos

Dos consultas de pacientes ficticios distintos, dos diagnósticos (uno por consulta), dos tratamientos, dos medicamentos con unidad verificada para el ensayo, tres lotes (dos del mismo medicamento, uno de otro), dos sucursales, identidades ficticias de médico/farmacia/enfermería/usuario sin permiso y stock inicial conocido (por ejemplo 10, 7 y 4 unidades). Las fechas de lote son sintéticas. No usar nombres, documentos ni tokens reales.

## Casos y oráculos

| ID | Caso | Resultado exigido y evidencia |
|---|---|---|
| P01 | Receta con dos medicamentos y pautas distintas | Una cabecera y dos líneas ordenadas; stock y `MovimientoInventario` sin cambios. |
| P02 | Diagnóstico o tratamiento de otra consulta | Rechazo completo; ninguna cabecera/línea. |
| P03 | Producto sin equivalencia aprobada, unidad ambigua o lote con concentración discordante | Bloqueo; nunca convertir texto de `Presentacion` a unidades. |
| P04 | Entrega parcial de dos unidades de una línea de cinco | Un detalle, un movimiento `Uso Interno`, una salida; stock −2; pendiente 3. |
| P05 | Segunda entrega de otra línea/lote, dentro del saldo | Cada detalle conserva lote correcto; pendiente por línea independiente. |
| P06 | Entrega sobre pendiente, lote equivocado, vencido o de sucursal ajena | `409`/rechazo según contrato; stock y eventos invariables. |
| P07 | Administración directa de una unidad | Un acto + un movimiento + una salida; stock −1; pendiente −1. |
| P08 | Administración de unidad previamente entregada | Un acto referido al detalle; **sin movimiento y sin cambio de stock**; pendiente ya reducido por entrega, permanece igual. |
| P09 | Dos administraciones simultáneas sobre la última unidad entregada | Solo una confirmación; suma administrada ≤ entregada; ningún nuevo descuento. |
| P10 | Administración externa | Acto sin lote interno, salida ni decremento; pendiente interno sin cambio hasta política. |
| P11 | Reintento con mismo UUID y mismo hash tras respuesta perdida | Recupera mismo ID/evento/movimiento; stock descontado una sola vez. |
| P12 | Mismo UUID con payload o actor distinto | `409`, sin revelar datos ajenos ni crear evento. |
| P13 | Dos entregas simultáneas de la última unidad pendiente | Una confirma; otra conflicto; suma entregada+directa ≤ prescrita. |
| P14 | Entrega vs venta/consumo legado simultáneos sobre stock final | No stock negativo; no deadlock persistente; orden de bloqueo consistente. |
| P15 | Falla inyectada tras cada etapa (cabecera, detalle, stock, movimiento, salida) y antes de COMMIT | ROLLBACK de **todas** las filas y del stock; reintento con la misma clave puede confirmar una sola vez. |
| P16 | Deadlock/timeout o COMMIT incierto | Consulta por UUID antes de reintentar; jamás nueva clave automática. |
| P17 | Escritura inconsistente directa contra FK/CHECK/UNIQUE de la copia aislada | Restricción impide lo que cubre; documentar las igualdades que solo valida servicio y negar DML directo al usuario de aplicación. |
| P18 | Tratamiento histórico sin receta | Consumo legado conserva contrato; no atribuir movimientos anteriores a `SalidaClinica`. |
| P19 | Tratamiento con receta nueva | `POST /consumos` legado y `PUT` que altera lote/cantidad rechazados por guard futuro. |
| P20 | Autorización médico/farmacia/enfermería/admin técnico/usuario ajeno | Denegar por defecto; probar 401/403/404, ámbito de consulta y sucursal; ningún permiso heredado de `Historial`. |
| P21 | Receta de consulta `Cerrada` o estado histórico `NULL` | Bloqueo conservador hasta política; `NULL` no se vuelve `Abierta`. |
| P22 | Corrección, devolución, reintegro y sustitución tras actividad | **No ejecutar** hasta D12/D13; primero aprobar protocolo y oráculos de compensación. |

## Instrumentación y criterios de salida

- Ejecutar clientes concurrentes en sesiones SQL independientes contra la **misma base aislada**. Comparar conteos/IDs antes y después, stock por lote, saldo por línea y vínculo evento–movimiento. Capturar códigos 2601/2627, 1205 y timeout sin datos clínicos.
- Verificar que el plan de consulta use índices por receta/línea; probar `SERIALIZABLE` con rangos vacíos, orden de bloqueo compatible con ventas y consumo, y que el `UPDATE` condicionado afecte exactamente una fila. Un test EF InMemory no acredita estas garantías.
- Revisar que el usuario de aplicación no tenga DDL ni DML directo fuera de los servicios autorizados; la política exacta se decidirá con seguridad/DBA. No modificar las 67 asignaciones actuales.
- Criterio de aceptación futuro: P01–P21 aplicables aprobados, ninguna duplicación/saldo negativo/relación cruzada, cero operación contra Azure, evidencia de conexión local y reporte de anomalías vacío. P22 requiere autorización clínica separada.
