# WEB-TRAT-05 — Compatibilidad y decisiones pendientes

| Contrato vigente | Propuesta WEB-TRAT-05 | Límite / guard futuro |
|---|---|---|
| `Consulta` → `Diagnostico` y `Tratamiento` por `IdConsulta` | `RecetaClinica` enlaza tratamiento y diagnóstico reales. | Igualdad de consulta verificada transaccionalmente; no agregar columnas a `Tratamiento`. |
| `Tratamiento.IdLote/Cantidad` opcionales; consumo legado crea salida | Receta multilínea usa `RecetaLinea`, sin lote al prescribir. | Tratar con receta: `IdLote/Cantidad` legados NULL; impedir PUT/consumo legado sobre gestionados. Históricos siguen operativos. |
| `LoteMedicamento.CantidadDisponible` entero y CHECK no negativo | Entrega y administración directa consumen unidades de lote. | Condición atómica + saldo; venta y consumo legado compiten por el mismo stock. |
| `MovimientoInventario` admite `Uso Interno` y no tiene origen | `SalidaClinica` vincula movimiento a detalle o administración directa. | Ninguna atribución retroactiva de movimientos antiguos. |
| `Factura/FacturaDetalle` comerciales; `HistorialMedico` narrativo | Eventos farmacéuticos y clínicos separados. | No reutilizar venta como entrega ni narrativa como clave relacional. |
| `Medicamento.Presentacion` textual; lote sin concentración estructurada | Instantánea propuesta en `RecetaLinea` más fuente gobernada por producto/lote. | **Brecha abierta D-U1:** sin fuente y validación aprobadas, bloquear el medicamento. |
| JWT + `Permiso` dinámico, 67 asignaciones actuales | Módulos independientes propuestos en `WEB-TRAT-04/MATRIZ-PERMISOS.md`. | Ninguna asignación o rol se modifica; administrador técnico no obtiene firma clínica implícita. |
| Estado de consulta nullable y tratamientos históricos | Receta `Vigente/Sustituida/Anulada` propuesta; entregas/administraciones son eventos inmutables. | `Cerrada`/`NULL` no habilitan actos nuevos automáticamente; transiciones clínicas pendientes. |

## Diferencias expresas frente a WEB-TRAT-03/04

1. Se preparó un DDL de **siete** tablas. Incluye seis columnas de instantánea de equivalencia en `RecetaLinea` no detalladas en el esquema original de WEB-TRAT-03, respondiendo a la brecha señalada en WEB-TRAT-04. Es un ajuste propuesto, no aprobado; no se añadió una octava tabla.
2. `RecetaClinica.IdRecetaAnterior` se propone con índice UNIQUE filtrado para impedir bifurcar una versión previa; la regla de sustitución tras una entrega continúa bloqueada.
3. FK compuestas **solo entre tablas propuestas** agregan `EntregaDetalle.IdReceta` y `SalidaClinica.OrigenAdministracion`: impiden cruzar una línea con otra receta y atribuir movimiento a `EntregaPrevia`. No alteran claves de tablas actuales.
4. El DDL contiene un `THROW` inicial permanente en esta revisión. No contiene `USE`, INSERT ni ALTER de tablas anteriores. La futura copia ejecutable requiere autorización nueva y cotejo de SQL Express.
5. `CorreccionClinica` se diseña físicamente pero sus operaciones quedan inhabilitadas hasta política de devolución/reintegro. El `TipoMovimiento` compensatorio y el efecto sobre pendientes no se inventan.
6. La prueba aislada incorpora carreras con venta/consumo legado y verificación expresa de conexión. No se declara atomicidad demostrada por pruebas en memoria.

## Decisiones que impiden pasar a implementación

| ID | Decisión necesaria | Responsable propuesto | Consecuencia mientras falta |
|---|---|---|---|
| D02 | Excepción expresa a BD inmutable para un entorno y objetos concretos, si alguna vez se plantea producción. | Propietario de datos + DBA. | Azure SQL intocable. |
| D-U1 | Aprobar fuente/versionado de equivalencias y la instantánea de seis columnas, o autorizar un catálogo adicional; definir lote, unidades, dosis, fraccionamiento y redondeo. | Farmacia + responsable clínico + arquitectura/DBA. | Productos sin validación bloqueados; DDL no listo para implantar flujo completo. |
| D03/D04 | Misma consulta, médico, estados de receta y continuidad tras cierre/NULL. | Clínica. | Sin nuevas escrituras clínicas. |
| D07/D08 | Cálculo de pendiente, significado de externo y administración desde entrega. | Farmacia + enfermería + clínica. | Sin flujo completo. |
| D09/D10 | Transacciones, idempotencia, acceso exclusivo de escritura o garantía relacional adicional. | DBA + arquitectura + seguridad. | Integridad cruzada no demostrada. |
| D11 | Permisos independientes y segregación de funciones. | Seguridad + propietario. | Ningún rol obtiene operaciones nuevas. |
| D12/D13 | Correcciones, devoluciones, reintegros y versiones tras suministro. | Clínica + farmacia. | Correcciones y sustituciones con actividad bloqueadas. |
| D14 | Longitudes/precisión/índices remotos y posibles objetos equivalentes. | DBA. | DDL no apto para cotejo productivo. |
| T06 | Autorizar SQL Server Express aislado, base sintética, copia revisada del script y ejecución de pruebas. | Propietario + DBA. | Ningún DDL ni test de escritura se ejecuta. |

La alternativa B continúa necesaria para cumplir WEB-TRAT-01 completo según `WEB-TRAT-02`, `WEB-TRAT-03` y `DB-AUDIT-AZURE-02`; el diseño de siete tablas describe la persistencia de eventos, pero la equivalencia farmacéutica y la integridad entre tablas aún requieren decisiones y pruebas.
