# WEB-TRAT-03 — Plan condicionado de implementación y validación

**Plan, no orden de ejecución.** La regla vigente prohíbe cambiar Azure SQL. Las fases 2–10 quedan detenidas hasta aprobación expresa de una excepción de esquema y de las políticas clínicas indicadas en [`DECISION.md`](DECISION.md). No se crea script, migración, código ni permiso durante WEB-TRAT-03. `WEB-TRAT-01` continúa bloqueado.

## Secuencia y puertas de aceptación

| Fase futura | Dependencia | Trabajo propuesto | Evidencia de aceptación antes de continuar |
|---|---|---|---|
| 1. Decisión de alcance y datos | Ninguna | Validar con docente/dirección clínica, farmacia, seguridad y DBA el modelo, unidades, estados, correcciones, permisos y excepción a BD inmutable. | Acta explícita que delimite objetos/ambientes; sin acta se conserva alternativa A y se declara WEB-TRAT-01 incompleto. |
| 2. DDL revisable, **no ejecutado** | 1 | Preparar scripts de siete tablas, FK, UNIQUE, CHECK e índices, con nombres finales; no migración automática. Revisar objetos equivalentes y definiciones remotas. | Revisión cruzada DBA/API/seguridad, plan de capacidad, dependencias, reversión y prueba en copia aislada. |
| 3. Respaldo y entorno aislado | 2 | Snapshot/backup verificado de esquema y datos **sintéticos** para SQL Server de pruebas; registrar hashes y versión, sin usar pacientes reales. | Restauración ensayada, cuenta de pruebas con privilegios limitados y prueba de no conexión a producción. |
| 4. Persistencia aislada | 3 | Aplicar exclusivamente el DDL aprobado al entorno de pruebas, mapear EF Core a tablas reales, probar restricciones. | Metadatos comparados con diseño; FK/UNIQUE/CHECK/índices efectivos; sin cambios en Azure productiva. |
| 5. API por cortes | 4 | Primero receta/lectura, luego entrega, administración, historial, por último correcciones tras política. Guardar `Tratamiento` y receta en una sola transacción si se elige creación conjunta. Guardar guardias para `PUT` y consumo legados. | `dotnet restore`, `dotnet build -c Release`, pruebas unitarias e integración SQL aislada del corte; auditoría RBAC/ámbito. |
| 6. WebClinica por cortes | 5 | Formularios en pestaña Tratamiento, vista farmacia, administración y línea temporal. Diseño existente Pacientes/Consultas; botones según permisos, estados de carga/error, reconsulta de saldos. | `npm run verify`, pruebas focalizadas y suite Angular, build producción, accesibilidad básica/responsive; el frontend no decide stock. |
| 7. Concurrencia y reconciliación | 5–6 | Cargas simultáneas con SQL Server aislado y ventas/consumos legados; job de conciliación **solo lectura** antes de automatizar reparación. | Cero stock negativo, sobreentrega, doble descuento, doble uso de unidad entregada o evento confirmado sin vínculo. |
| 8. Seguridad | 5–7 | Revisión de JWT, permisos dinámicos, médico responsable, sucursal, filtrado por paciente y logs; probar 401/403/404 y no filtración. | Matriz de roles aprobada y pruebas con usuarios sintéticos; no cambiar las 67 asignaciones existentes sin autorización separada. |
| 9. Plan de despliegue | 7–8 y autorización de infraestructura | Ventana, orden DDL/API/SPA, compatibilidad temporal, monitorización y conciliación; ejecutar solo en fase posterior autorizada. | Aprobación de DBA/propietario; backup restaurable; smoke no productivo; plan de corte y reversión ensayados. |
| 10. Reversión y cierre | 9 | Ante fallo, detener escrituras nuevas; conservar eventos confirmados, conciliar inventario, restablecer binarios compatibles y decidir corrección clínica. | Ninguna reversión destructiva de movimientos ni DROP de tablas con eventos; informe de conciliación y aceptación clínica/DBA. |

## Matriz mínima de pruebas en SQL Server aislado

| Caso | Resultado exigido |
|---|---|
| Consulta con dos diagnósticos; tratamiento y receta | Solo admite `IdDiagnostico` de la misma consulta; correlativo visual nunca persiste. |
| Receta con dos o más medicamentos/pautas | Líneas y cantidades independientes; ninguna salida al prescribir. |
| Línea sin unidad de inventario verificable o conversión ambigua | Rechazo antes de guardar receta, sin descuento. |
| Entrega parcial de una o varias líneas/lotes | `pendiente` correcto; cada detalle enlaza exactamente un movimiento `Uso Interno`; lotes/medicamentos coinciden. |
| Entrega que excede prescrito o stock; lote vencido/ajeno a sucursal | `409`/validación apropiada; cero cabeceras, detalles, movimientos o descuentos parciales. |
| Dos usuarios compiten por último stock; venta y farmacia simultáneas | Solo suma disponible se confirma; no saldo negativo ni deadlock sin tratamiento de reintento seguro. |
| Doble clic, reenvío y pérdida de respuesta tras COMMIT | Misma clave+hash recupera mismo ID y movimiento; distinta carga con misma clave `409`; no segundo descuento. |
| Falla después de decrementar y antes de crear vínculo | ROLLBACK de stock, entrega y movimiento; reintento con misma clave posible. |
| Administración directa | Un acto, una salida y un descuento, con FK de origen. |
| Administración de entrega en varias partes; dos solicitudes simultáneas | Sin nueva salida; suma administrada ≤ cantidad de `EntregaDetalle`; una confirmación por clave. |
| Administración externa | Acto registrado sin lote interno ni movimiento; no falsear pendiente interno. |
| Receta cerrada, consulta cerrada o estado `NULL` histórico | Comportamiento según política aprobada, sin tratar `NULL` como abierta. |
| Médico ajeno, farmacia de otra sucursal, ausencia de permiso, usuario inactivo | Rechazo y ninguna información clínica ajena; probar 401/403/404/409. |
| Tratamiento histórico con `IdLote/Cantidad` y movimiento previo | GET/PUT/consumo legado mantienen contrato; movimientos históricos no se atribuyen a receta. |
| Tratamiento gestionado con receta intenta PUT/consumo legado | `409` sin edición, salida ni descuento. |
| Sustitución y corrección con/ sin entregas | Antes de política: bloqueadas. Después de aprobarla: versión/evento inmutable, ajuste controlado; reintegro solo con devolución física y movimiento compensatorio. |
| Conciliación | Detecta cabecera sin detalle, salida sin vínculo, vínculo duplicado, lotes/cantidades divergentes y administraciones > entrega; nunca repara sola. |
| Regresión | Pruebas de consulta/diagnóstico/tratamiento, ventas/factura, inventario, RBAC, evaluación y las pestañas clínicas siguen aprobadas. |

Las pruebas de escrituras se ejecutarán **solo** contra base de pruebas aislada; los tests existentes que crean/destruyen esquemas no se ejecutan contra Azure productiva. Un build o mocks Angular no demuestran atomicidad ni seguridad clínica. Registrar transacciones, IDs sintéticos, assertions de stock y movimientos, y evidencia de que la cadena de conexión corresponde a pruebas.

## Flujo Angular propuesto, sin implementación

- **Tratamiento:** diagnóstico descriptivo y su ID real, descripción/fechas, editor de varias líneas con medicamento, pauta, dosis, vía, frecuencia, duración y unidades prescritas; validación y aviso de que guardar no descuenta. Mostrar consulta/paciente/médico ya relacionados, sin enviarlos como autoridad.
- **Farmacia:** recetas pendientes autorizadas, cantidad prescrita/entregada/pendiente por línea, lotes y stock observado, confirmación explícita de entrega parcial/completa con clave fija para reintento. Reconsultar saldos después de `201/200/409`; nunca confiar en stock cacheado.
- **Administración clínica:** paciente, consulta, receta/línea, dosis, origen (`InventarioDirecto`, `EntregaPrevia`, `Externo`), lote o entrega según origen, responsable/fecha devueltos por API. Advertir que solo directa descuenta. Confirmación con clave fija, no doble clic.
- **Historial:** línea temporal paginada de versiones, prescripción, entregas, administraciones, salidas y correcciones; filtros y acciones limitados por permisos. No mezclar factura ni atribuir movimientos históricos sin FK.

El frontend conserva visual Pacientes/Consulta, estados de carga/vacío/error, teclado/responsive y mensajes de 401/403/404/409. No accede directamente a Azure SQL ni R2.

## Respaldo, despliegue y reversión conceptual

Antes de cada futura fase técnica, inventariar Git y respaldar archivos/DDL aprobados con SHA256 fuera del repositorio; probar lectura independiente. Para un despliegue eventual, preferir secuencia expansiva: DDL aprobado en ventana → API compatible con contrato legado y nuevos endpoints deshabilitados hasta comprobación → frontend → permisos expresamente asignados → activar por cohortes. Monitorizar errores, conflictos, stock y conciliación. Si falla, desactivar nuevas escrituras y restituir versión de API/SPA compatible; **no** borrar tablas/eventos ni sumar stock manualmente. Una transacción confirmada exige corrección contable/clínica auditable, no rollback de archivos. Toda reversión estructural requiere decisión posterior del DBA y política de retención.

## Verificación de esta fase documental

WEB-TRAT-03 solo requiere comprobar existencia de los cinco documentos, vínculos relativos, formato y `git diff --check`. No ejecutar dotnet/npm/SQL: no cambió ningún archivo funcional ni contrato real. No hacer commit, push o despliegue.
