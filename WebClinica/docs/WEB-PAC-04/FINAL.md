# WEB-PAC-04 — Ficha médica de paciente de solo lectura

## A. Diagnóstico de navegación

El botón de ojo en `PacientesComponent` abría `/historial/{id}` y exigía `Consultas/Consultar`. Ahora abre `/pacientes/{id}/ficha` con el `IdPaciente` real. La ruta nueva exige `Pacientes/Consultar`; el historial existente sigue accesible desde la ficha solo con `Consultas/Consultar`. Edición y baja lógica conservaron sus acciones.

## B. Matriz de información

| Dato | Fuente API y relación | Permiso | Disponible y acción |
| --- | --- | --- | --- |
| Datos generales y estado | `GET /api/pacientes/{id}`; ID exacto | Pacientes/Consultar | Sí; mostrar |
| Fotografía | `GET /api/pacientes/{id}/foto`; Blob protegido cuando el paciente informa foto | Pacientes/Consultar | Sí; mostrar URL de objeto local, nunca URL de R2 |
| Contactos | `GET /api/contactos-emergencia?idPaciente=...`; respuesta con ID de paciente | ContactosEmergencia/Consultar | Sí; paginar y distinguir activos/retirados |
| Consultas | `GET /api/consultas?idPaciente=...`; respuesta con ID de paciente | Consultas/Consultar | Sí; paginar y enlazar historial existente |
| Diagnósticos | `GET /api/diagnosticos?idConsulta=...`; consulta seleccionada | Historial/Consultar | Sí; resumen bajo demanda |
| Tratamientos | `GET /api/tratamientos?idConsulta=...`; consulta e ID de paciente verificados | Historial/Consultar | Sí; resumen bajo demanda |
| Exámenes | `GET /api/examenes?idConsulta=...` y `?idDiagnostico=...`; consulta y paciente verificados | Historial/Consultar | Sí; nombre y fechas. El DTO no contiene resultado clínico |
| Evoluciones | `GET /api/historial-medico?idConsulta=...`; atribución de consulta y paciente verificada | Historial/Consultar | Sí; resumen bajo demanda |
| Asignaciones de habitación | `GET /api/asignaciones-habitacion` paginado, sin filtro por paciente | AsignacionesHabitacion/Consultar | No integrado; el contrato no proporciona consulta directa por paciente |

## C–F. Diseño, contratos e integración

La ficha contiene encabezado con nombre, estado, foto e ID; datos generales y edad calculada desde `DateOnly`; contactos paginados; consultas paginadas; y resumen clínico de la consulta seleccionada. Todas las operaciones son GET. El resumen consume todas las páginas devueltas por los filtros clínicos, valida la atribución y descarta información contradictoria. El botón de ojo usa el ID real; lápiz y baja lógica permanecen en el listado.

Archivos de esta fase: `src/app/app.routes.ts`, `src/app/pages/pacientes/pacientes.component.ts`, `src/app/pages/pacientes/pacientes.component.spec.ts`, `src/app/pages/pacientes/paciente-ficha.component.ts` y `src/app/pages/pacientes/paciente-ficha.component.spec.ts`. No se modificaron contratos HTTP existentes, backend ni dependencias.

## G. Respaldo

`Respaldos-API-Clinica/WEB-PAC-04/` contiene 16 originales con rutas relativas, tamaño y SHA256. Segunda lectura y comprobación final: 16/16 válidos, cero discrepancias. SHA256 del manifiesto final: `3E04BF166156256BC8771228639C7ADDDB82C2B27ACCFF934A93F234BA20F2BE`. El respaldo permanece sin versionar en el repositorio.

## H. Permisos y protección de datos

El guard exige `Pacientes/Consultar`; cada sección comprueba su permiso específico y el servidor conserva la autorización real. Se validan IDs de ruta y pertenencia de respuestas. Cambios de ruta, sesión o permisos cancelan o invalidan lecturas anteriores y limpian la ficha. La foto usa Blob del endpoint protegido y revoca la URL de objeto al salir. No se almacena información médica en `localStorage` ni se usa URL pública de R2.

## I–K. QA y build

Se añadieron 20 pruebas para ruta, permisos, estados, foto, contactos y paginación, asociaciones clínicas, respuestas ajenas, sesión, edad y ausencia de escrituras. La aserción previa del botón de ojo se actualizó a la nueva ruta sin relajar la comprobación del ID.

- `npm run verify`: correcto, 48 plantillas.
- `npm test -- --watch=false --browsers=ChromeHeadless`: 1043/1043 aprobadas; línea base real anterior 1023/1023.
- `npm run build -- --configuration production`: correcto.
- `npm ls --depth=0`: correcto; Angular 21.2.25 y builder/CLI 21.2.27.
- `git diff --check`: correcto.

Las pruebas nuevas usan mocks de servicios. No se ejecutó integración E2E con datos clínicos reales ni operaciones productivas.

## L. Limitaciones clínicas

El contrato de exámenes expone `fechaResultado`, pero no texto, archivo ni interpretación del resultado. No se presenta como resultado clínico. Las asignaciones de habitación no se muestran por falta de filtro API por paciente. Los informes `WEB-PAC-01/FINAL.md`, `WEB-PAC-02/FINAL.md`, `WEB-PAC-03/FINAL.md`, `CLOSE-07C/FINAL.md` y `CLOSE-07D/FINAL.md` no estaban disponibles en el árbol consultado; se verificaron los contratos actuales en código.

## M. Estado

**WEB-PAC-04 completado.** API-Clinica, Azure SQL, JWT, RBAC y R2 intactos. Sin migraciones, escrituras productivas, commit, push ni despliegue.
