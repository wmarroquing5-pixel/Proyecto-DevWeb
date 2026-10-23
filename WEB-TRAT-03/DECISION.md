# WEB-TRAT-03 — Decisión arquitectónica para revisión

**Decisión propuesta:** mantener bloqueada la implementación completa de `WEB-TRAT-01`. La alternativa A (esquema vigente) solo permite tratamiento de un lote opcional y consumos independientes; la alternativa B es necesaria para receta multilínea, entrega parcial, administración de tres orígenes, salida atribuible e idempotencia persistente. B requiere siete estructuras nuevas **y una excepción explícita** a `AGENTS.md`/skill `database-contract`, que hoy prohíben alterar la base. Este documento no concede esa excepción ni inicia implementación.

## Alternativas evaluadas

| Alternativa | Ventaja | Límite y riesgo | Resultado para WEB-TRAT-01 |
|---|---|---|---|
| A. Solo tablas y endpoints actuales | Cero DDL; aprovecha transacción serializable del consumo y conserva legados. | Sin relación tratamiento–diagnóstico, sin receta multilínea, entrega/admin estructurada, origen persistente del movimiento o clave idempotente. Reintentos pueden descontar de nuevo. | **No cumple** el flujo integrado. Podría mantenerse como alcance reducido, etiquetado honestamente, con aprobación aparte. |
| B. Siete tablas especializadas, API y WebClinica nuevas | Puede garantizar cadena receta→entrega/administración→movimiento, saldos y reintentos seguros; no toca columnas actuales. | Contradice regla de BD inmutable; añade complejidad clínica, permisos, DDL y despliegue. FK individuales no prueban pertenencia cruzada por sí solos; se requiere servicio transaccional, o más índices/clave compuesta en tablas actuales bajo autorización adicional. | **Necesaria** para cumplimiento completo, **no autorizada**. |

Las siete estructuras se justifican en [`DISENO-FINAL.md`](DISENO-FINAL.md) y se comparan con el esquema actual en [`MATRIZ-CAMBIOS.md`](MATRIZ-CAMBIOS.md). `CorreccionClinica` puede aplazarse como corte técnico si se bloquean correcciones/sustituciones con actividad; no se puede declarar completo el historial de rectificación hasta implementarla y aprobar su política. Una solución con menos tablas que omita `SalidaClinica` o una relación global equivalente dejaría ambiguo el origen único de salidas; omitir `EntregaDetalle` impediría parcialidad por línea/lote. No se propone usar `FacturaDetalle`, `HistorialMedico.Descripcion` o `Bitacora.RegistroId` como enlaces clínicos.

## Garantías y compatibilidad histórica

En B, prescribir no descuenta. Entrega confirmada y administración directa descuentan **una vez** dentro de la misma transacción que crea evento y movimiento; administración desde entrega y externa no descuentan. UNIQUE de clave/hash evita duplicación por reintento, bloqueos/saldo impiden sobreentrega y sobreadministración, y `SalidaClinica` asocia cada nuevo movimiento a un evento. Estas son garantías de diseño **aún no demostradas por pruebas**. Requieren SQL Server aislado, políticas de unidad y pruebas de concurrencia con ventas/consumos existentes.

`Tratamiento.IdLote/Cantidad` y `POST /api/tratamientos/{id:int}/consumos` continúan para históricos. Para tratamientos con receta B, el `PUT` legado no podrá alterar lote/cantidad ni el POST de consumo generar salidas sin vínculo. No se reetiquetan movimientos previos por fecha/texto y no se alteran facturas ni 67 asignaciones RBAC. La divergencia `IX_Bitacora_Tabla_Fecha` EF/Azure comunicada por SSMS permanece documentada y fuera de este diseño.

## Riesgos y decisiones previas obligatorias

1. **Regla de esquema:** confirmar si el propietario académico/técnico autoriza una excepción concreta a la inmutabilidad para siete tablas, FK, UNIQUE, CHECK e índices, y en qué entorno. Sin ella solo es admisible A y WEB-TRAT-01 sigue bloqueado.
2. **Contrato SQL real:** completar con la identidad de metadatos restringida la verificación de longitudes/precisión, índices no primarios y posibles estructuras equivalentes con otros nombres. Los hallazgos remotos disponibles proceden del usuario en SSMS; Codex no tuvo conexión.
3. **Prescripción:** decidir si la nueva API vincula un tratamiento creado o crea Tratamiento+Receta en una transacción; quién firma si el usuario autenticado no es el médico responsable; si se permite prescribir desde consulta `Abierta`, `En seguimiento`, `Cerrada` o `NULL` histórica.
4. **Unidades:** aprobar unidad dispensable por medicamento/lote y conversión de dosis a unidades de stock, especialmente líquidos e inyectables. `Medicamento.Presentacion` textual no basta como tabla de conversión.
5. **Entrega/administración:** definir si administración externa satisface la cantidad prescrita; si se permite entregar tras consulta cerrada; alcance por sucursal y profesional autorizado.
6. **Versiones/correcciones:** decidir sustitución tras una entrega, anulación, devolución física/aptitud, movimiento de reintegro, correcciones de administración y conciliación. Hasta aprobarlo, bloquear correcciones con stock y no presentar pendiente recalculado como verdad clínica.
7. **Seguridad:** aprobar módulos/permisos independientes y su asignación expresa a usuarios/roles; `Administrador` no firma por defecto, `MEDICO` no dispensa por defecto. Evitar ampliar automáticamente las 67 asignaciones.
8. **Operación:** confirmar retención, auditoría de acceso, rollout, restauración, reconciliación y plan de reversión sin borrar eventos confirmados.

## Recomendación de autorización

Recomiendo aprobar **solo la revisión formal** del modelo B y las decisiones anteriores como siguiente paso. Una autorización de implementación debe identificar con precisión objetos, políticas, fases y entorno aislado; después se prepara DDL revisable, se prueba con datos sintéticos, y solo otra aprobación puede permitir producción. Si la inmutabilidad de Azure SQL es absoluta, documentar A como alcance reducido y cerrar la expectativa de flujo completo como no viable bajo las restricciones actuales. Véanse los contratos propuestos en [`CONTRATOS-API.md`](CONTRATOS-API.md) y el plan condicionado en [`PLAN-IMPLEMENTACION.md`](PLAN-IMPLEMENTACION.md).

**Estado WEB-TRAT-03:** diseño preparado para revisión documental. **Estado WEB-TRAT-01:** bloqueado. Ningún cambio de código, Azure SQL, datos, permisos o despliegue queda autorizado por este cierre.
