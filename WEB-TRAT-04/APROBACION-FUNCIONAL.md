# WEB-TRAT-04 — Propuesta de aprobación funcional

**Estado:** preparada para revisión, **sin aprobación clínica ni autorización de implementación**. La única decisión expresa del propietario para esta fase es preparar documentación, conservar Azure SQL/API/WebClinica/permisos sin cambios y mantener `WEB-TRAT-01` bloqueado. Las reglas siguientes son recomendaciones; su aceptación debe quedar registrada en [`ACTA-DECISION.md`](ACTA-DECISION.md). Referencias: [`WEB-TRAT-02`](../WEB-TRAT-02/DISENO.md), [`WEB-TRAT-03/DISENO-FINAL.md`](../WEB-TRAT-03/DISENO-FINAL.md) y [`WEB-TRAT-03/DECISION.md`](../WEB-TRAT-03/DECISION.md).

## 1. Diagnóstico, tratamiento y receta

| ID | Regla propuesta | Responsable de aprobar | Estado |
|---|---|---|---|
| F01 | Una receta corresponde a **un** tratamiento y **un** diagnóstico existente de la misma consulta. El médico elige el diagnóstico por descripción/correlativo visual; se persiste solo `IdDiagnostico`. No inferir relación por fecha o texto. | Responsable clínico + propietario | Pendiente |
| F02 | La consulta determina paciente, médico y sucursal; el prescriptor autenticado debe ser el médico responsable habilitado o cumplir una delegación clínica formal todavía no definida. El administrador técnico no firma recetas por defecto. | Responsable clínico + seguridad | Pendiente |
| F03 | Una receta tiene una o más líneas de medicamento, con dosis, unidad de dosis, vía, frecuencia, duración, indicaciones, cantidad entera en unidades de inventario y medicamento real. El lote se selecciona al dispensar o administrar directamente. | Responsable clínico + farmacia | Pendiente |
| F04 | Guardar tratamiento/receta no descuenta stock. Tratamiento y receta se crean/vinculan atómicamente si la API decide crearlos juntos; no dos POST independientes que dejen un tratamiento huérfano. | Propietario + arquitectura | Pendiente |
| F05 | Una pauta confirmada es inmutable. Una versión nueva sustituye a la previa sin borrar historial. Sustitución con entregas/administraciones previas queda bloqueada hasta definir reasignación de saldos y rectificación. | Responsable clínico + farmacia | Pendiente |

`Tratamiento.IdLote/Cantidad` se reserva a registros legados; las líneas nuevas son la única fuente de cantidades prescritas. El contrato actual no vincula tratamiento con diagnóstico ni representa una receta multilínea. La interfaz debe explicar esa distinción durante cualquier convivencia futura.

## 2. Estados y transiciones propuestos

Estos son **estados de diseño**, no valores aprobados en producción. Solo `RecetaClinica.Estado` se propone persistir; entrega y administración son eventos inmutables con estados de presentación derivados. No añadir `DEFAULT` que declare clínicamente un estado sin acto confirmado.

| Objeto | Estados permitidos propuestos | Transiciones/regla | Decisión pendiente |
|---|---|---|---|
| Prescripción/receta | `Vigente`, `Sustituida`, `Anulada` | Primera confirmación → `Vigente`; `Vigente` → `Sustituida` solo con nueva versión válida; `Vigente` → `Anulada` solo con corrección autorizada. Nunca volver a `Vigente` una versión sustituida/anulada. | Definir si anulación y sustitución se permiten tras suministro y con consulta cerrada. |
| Suministro por línea de receta | `Pendiente`, `Parcialmente suministrada`, `Completamente suministrada` | **Derivado** de cantidad prescrita menos entregas y administraciones directas confirmadas. No se almacena como campo libre. | Aprobar fórmula final ante correcciones y medicamento externo. |
| Entrega de farmacia | `Confirmada` o `Rectificada` | Al confirmar existe cabecera, ≥1 detalle y movimientos vinculados en una transacción. `Rectificada` solo se infiere de corrección aprobada; no se modifica ni borra la entrega. | Tipos y efectos de rectificación/devolución. |
| Administración clínica | `Registrada` o `Rectificada` | Una administración es un acto inmutable; `Rectificada` solo si existe corrección autorizada. No hay “pendiente” persistido para un acto aún no realizado. | Procedimiento de corrección de acto clínico, sin borrar evidencia. |
| Borrador en WebClinica | Solo estado local de formulario | No tiene validez de receta, entrega o administración; no afecta stock ni se presenta como confirmado. | Política de expiración/autoguardado, si se desea. |

Recomendación conservadora: mientras no se apruebe continuidad asistencial, no iniciar recetas, entregas ni administraciones nuevas sobre consultas `Cerrada`; los registros históricos con `EstadoConsulta = NULL` **no** se tratan como `Abierta`. La política exacta por estado requiere decisión clínica; la API debe rechazar o solicitar revisión, nunca escoger un estado ficticio.

## 3. Unidades, dosis y equivalencias

La cantidad de `LoteMedicamento.CantidadDisponible` es un entero, pero el esquema actual no define una equivalencia clínica universal entre ese entero y mg, ml, tabletas, ampollas o envases. `Medicamento.Presentacion` existe en script/EF como texto; **no es** una tabla de conversión ni prueba de contenido por unidad. Dos productos con la misma descripción pueden tener concentraciones distintas.

**Procedimiento propuesto por medicamento/presentación/lote, antes de habilitarlo:** farmacia y responsable clínico documentan la unidad física que se descuenta, concentración/contenido verificable por unidad, dosis prescrita, factor de conversión, redondeo permitido, divisibilidad y fuente aprobada (ficha técnica o registro de producto). Conservar versión/fecha/responsable de esa equivalencia para explicar recetas históricas. La API valida que `CantidadPrescritaUnidades` y cada entrega/administración se expresen en esa unidad; no deriva el factor de `Presentacion` ni de texto libre. **Brecha de WEB-TRAT-03:** las siete tablas no incluyen por sí solas un catálogo versionado de equivalencias; se requiere decidir una fuente gobernada externa o ampliar el diseño de `RecetaLinea` con una instantánea verificable del factor/fuente. Esto puede cambiar la propuesta DDL y necesita aprobación específica. Hasta resolverlo, bloquear productos con conversión ambigua; un caso 1:1 solo se admite con verificación documentada, no por presunción.

| Ejemplo conceptual | Lo que debe verificarse | Lo que no puede asumirse |
|---|---|---|
| Tableta de concentración conocida | Concentración por tableta, tabletas dispensables y divisibilidad permitida. | Que “1 dosis” equivale siempre a una tableta. |
| Solución oral o inyectable | Concentración, volumen por unidad de stock y fraccionamiento/merma. | Que un número en ml pueda restarse del stock entero sin regla. |
| Caja/envase | Unidades internas reales y si el inventario descuenta caja o unidad. | Que el nombre/presentación textual determine el factor. |

## 4. Entrega de farmacia y administración

| ID | Regla propuesta | Responsable de aprobar | Estado |
|---|---|---|---|
| F06 | Una entrega puede ser parcial por línea y lote. El total entregado + administrado directamente no supera lo prescrito. Cada entrega confirmada descuenta exactamente las unidades entregadas y registra responsable, fecha, lote, movimiento y origen. | Farmacia + responsable clínico | Pendiente |
| F07 | Farmacia valida lote vigente, medicamento de la línea, sucursal autorizada, stock y saldo **al confirmar**. Una vista previa de stock no reserva unidades. | Farmacia + DBA | Pendiente |
| F08 | Administración `InventarioDirecto`: acto clínico más una salida/descuento en una transacción. `EntregaPrevia`: referir detalle de entrega y limitar cantidad disponible; no volver a descontar. `Externo`: acto documentado sin lote ni salida internos. | Enfermería + farmacia + responsable clínico | Pendiente |
| F09 | La suma de administraciones desde una `EntregaDetalle` no supera su cantidad confirmada, aun con solicitudes concurrentes. Entrega previa y externa no reducen stock. | Enfermería + arquitectura | Pendiente |
| F10 | El medicamento externo se informa por separado y no reduce el saldo interno pendiente hasta aprobación clínica de su significado para la receta. | Responsable clínico | Pendiente |

## 5. Correcciones, devoluciones y legados

El procedimiento de corrección queda **pendiente de aprobación clínica y farmacéutica**. Recomendación: crear un evento `CorreccionClinica` con referencia al original, motivo, actor, fecha y autorización; conservar íntegro el evento original. Una anulación documental no repone existencias. Un reintegro solo podría efectuarse tras acreditar devolución física, aptitud/estado del medicamento, lote, cantidad y responsable, con movimiento compensatorio vinculado en la misma transacción. Deben definirse tipo de movimiento permitido, manejo de producto no retornable, efecto sobre pendientes, doble firma si procede y retención. **Hasta entonces: no habilitar correcciones que afecten stock ni sustituciones con suministro.**

Los tratamientos y movimientos anteriores conservan el contrato vigente. No se atribuyen retrospectivamente a una receta por coincidencia de fecha, medicamento o descripción. En el futuro, tratamientos con receta gestionada no podrán usar el `PUT` legado para cambiar lote/cantidad ni `POST /api/tratamientos/{id}/consumos`; los históricos sí. La UI debe identificar “histórico sin vínculo de receta” sin fabricar trazabilidad.

## 6. Responsables de la aprobación

- **Propietario del proyecto:** alcance, excepción de esquema y autorización eventual por entorno/estructuras; no la ha concedido en WEB-TRAT-04.
- **Responsable clínico/médico designado:** diagnóstico, prescripción, estados de consulta, sustitución, dosis y correcciones clínicas.
- **Farmacia responsable:** unidades de inventario, equivalencias, lotes, entregas, devoluciones/reintegros y conciliación.
- **Enfermería responsable:** registro de administración, origen, dosis aplicada y rectificación del acto.
- **DBA/arquitectura:** integridad referencial, transacciones, índices y recuperación, sin ejecutar DDL antes de la excepción.
- **Seguridad/RBAC:** matriz de permisos, segregación de funciones y acceso por paciente/consulta/sucursal.

Ningún nombre o firma individual fue proporcionado; asignar personas y fecha de aprobación en el acta antes de pasar a implementación.
