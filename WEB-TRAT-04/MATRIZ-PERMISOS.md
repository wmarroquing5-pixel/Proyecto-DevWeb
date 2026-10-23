# WEB-TRAT-04 — Matriz de permisos propuesta

**No se cambia `dbo.Permiso`, ningún rol ni las 67 asignaciones actuales.** La API usa `PermisoRequerido(módulo, Operacion)` y operaciones `Consultar/Crear/Modificar/Eliminar`; los módulos nuevos de [`WEB-TRAT-03/CONTRATOS-API.md`](../WEB-TRAT-03/CONTRATOS-API.md) son nombres de diseño, no permisos concedidos. `MEDICO` aparece en lógica actual; el tipo de empleado `Enfermera` existe en validación de empleados. No se ha verificado que existan roles específicos de **Farmacia** o **Enfermería** ni quién los integra. La asignación final exige inventario de identidades/roles y aprobación de seguridad/propietario.

## Principios obligatorios propuestos

1. Denegar por defecto. El permiso de módulo **más** la pertenencia clínica, usuario activo, sucursal y estado del recurso se verifican en servidor. Un botón oculto en Angular no autoriza nada.
2. `Historial/Crear`, `Historial/Consultar`, `ConsumoClinico/Crear`, `LotesMedicamento/Consultar` y `Facturas` **no** se heredan como permisos para el flujo nuevo. Las operaciones comerciales no conceden entrega clínica.
3. Los controladores propuestos comprueban permiso dinámico; los servicios comprueban vínculo real con consulta/paciente/médico o sucursal, incluso si el usuario tiene rol `Administrador`.
4. No usar `Operacion.Eliminar` para borrar receta, entrega o administración confirmada. Correcciones son eventos nuevos con permiso separado, motivo y política de doble control si se aprueba.
5. GET devuelven solo datos mínimos del ámbito autorizado. Los IDs no son prueba de autorización; evitar diferencias de error que permitan enumerar pacientes.

## Matriz de operaciones y capacidades recomendadas

**Leyenda:** P = propuesta de capacidad que requiere asignación expresa; — = no conceder por función; C = condicionado a una delegación/política formal. Ninguna celda es una asignación real.

| Operación / permiso técnico propuesto | Médico responsable | Farmacia designada | Enfermería designada | Administrador técnico | Control adicional |
|---|---:|---:|---:|---:|---|
| Leer recetas de consulta `PrescripcionClinica/Consultar` | P | C | C | C | Ámbito de paciente/consulta y necesidad de atención; farmacia/enfermería solo datos necesarios. |
| Prescribir `PrescripcionClinica/Crear` | P | — | — | — | `Usuario.IdEmpleado` corresponde a `Consulta.IdMedico`, diagnóstico/tratamiento de la consulta, estado autorizado. Delegaciones pendientes de política. |
| Versionar pauta `PrescripcionClinica/Modificar` | C | — | — | — | Solo médico responsable y sin suministro previo, hasta aprobar sustituciones con actividad. Nunca PUT destructivo. |
| Ver pendientes y lotes `EntregaFarmacia/Consultar` | C | P | — | C | Sucursal asignada; inventario observado no implica reserva. Puede requerir además lectura acotada de lotes. |
| Confirmar entrega `EntregaFarmacia/Crear` | — | P | — | — | Identidad farmacéutica real, receta visible/vigente, lote/sucursal/stock/saldo, idempotencia. |
| Consultar administraciones `AdministracionClinica/Consultar` | P | C | P | C | Equipo asistencial de la consulta; farmacia solo para conciliación autorizada. |
| Registrar administración `AdministracionClinica/Crear` | C | — | P | — | Profesional habilitado para administrar, origen demostrado, dosis y saldo; si médico administra, habilitación expresa. |
| Leer trazabilidad clínica `HistorialClinicoFarmaco/Consultar` | P | C | P | C | Filtrado por paciente/consulta y minimización de datos; administrador solo función de auditoría aprobada. |
| Registrar corrección `CorreccionClinica/Crear` | C | C | C | — | **Bloqueado por ahora**; tipo de corrección, autoridad y doble revisión según protocolo clínico/farmacia. |
| Consultar correcciones `CorreccionClinica/Consultar` | P | C | P | C | Mismo ámbito; incluir actor/motivo según necesidad y privacidad. |

`PrescripcionClinica`, `EntregaFarmacia`, `AdministracionClinica`, `HistorialClinicoFarmaco` y `CorreccionClinica` son propuestas coherentes con el borrador de contratos; antes de implementarlas, confirmar longitudes/convenciones de `Permiso.Modulo` y el catálogo dinámico. La matriz de rol **no** reemplaza la validación por objeto. Si los roles Farmacia/Enfermería no existen, definir cómo identificar profesionales habilitados sin ampliar privilegios por semejanza de nombre; cualquier cambio de roles/permisos requiere autorización posterior distinta.

## Segregación y conflictos de interés

Recomendación de separación: quien prescribe no confirma la entrega de su misma receta; quien entrega no certifica una devolución/reintegro sin revisión independiente; quien administra no aprueba su propia corrección cuando modifica stock. El sistema debe registrar actor real, fecha y ámbito para cada evento. Si una institución pequeña requiere acumulación de funciones, documentar excepción por persona, vigencia y supervisor; no hacerla automática por `Administrador`.

La política actual usa módulos CRUD. `Operacion.Modificar` para crear una **nueva versión** no permite editar eventos confirmados; `Operacion.Eliminar` queda sin uso para estos recursos. El proceso de doble aprobación no está modelado aún en las siete tablas de WEB-TRAT-03; es una **brecha** si se vuelve obligatorio para correcciones. Hasta decidirlo, el endpoint correctivo no puede considerarse listo.

## Validaciones futuras por endpoint

| Endpoint conceptual | Permiso mínimo | Comprobación de ámbito y respuesta |
|---|---|---|
| `POST /api/consultas/{idConsulta}/recetas` | `PrescripcionClinica/Crear` | Médico de esa consulta, diagnóstico y tratamiento de la misma consulta; no revelar recursos ajenos. |
| `GET /api/consultas/{idConsulta}/recetas`, `GET /api/recetas/{idReceta}` | `PrescripcionClinica/Consultar` o historial autorizado | Paciente/consulta visible; paginación y datos mínimos. |
| `GET /api/recetas/pendientes`, lotes disponibles | `EntregaFarmacia/Consultar` | Sucursal y función farmacéutica; los lotes deben revalidarse al confirmar. |
| `POST /api/recetas/{idReceta}/entregas` | `EntregaFarmacia/Crear` | Farmacia/sucursal autorizada; receta y stock en transacción. |
| `POST /api/recetas/{idReceta}/administraciones` | `AdministracionClinica/Crear` | Profesional habilitado, receta/paciente, origen y saldo. |
| `GET /api/recetas/{idReceta}/movimientos` | `HistorialClinicoFarmaco/Consultar` y política de inventario | Solo movimientos vinculados a receta visible; no listar inventario de otras sucursales. |
| `GET /api/operaciones-clinicas/{tipo}/{clave}` | Permiso de lectura del evento original | Repetición idempotente no expone resultado a quien perdió acceso. |
| `POST /api/recetas/{idReceta}/correcciones` | `CorreccionClinica/Crear` | Deshabilitado hasta política clínica/farmacia, alcance y posible doble control. |

**Aprobación pendiente:** propietario y seguridad deben identificar personas/roles reales, matriz final, delegaciones, segregación y pruebas con usuarios sintéticos. No se editan las 67 asignaciones existentes en WEB-TRAT-04.
