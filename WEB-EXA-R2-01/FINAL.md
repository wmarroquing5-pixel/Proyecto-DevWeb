# WEB-EXA-R2-01 — Exámenes y resultados documentales

**Estado: implementación local validada; integración real con R2 y Azure SQL pendiente de comprobación.** 22/10/2026.

## Diagnóstico y contrato

- `ExamenService` ya registra/lista exámenes y acepta `NombreExamen`, `FechaExamen`, `FechaResultado` y prioridad `Baja`, `Media` o `Alta`. `IdPaciente` e `IdMedico` se derivan de la consulta o del diagnóstico. El formulario anterior solo recogía nombre y fecha; su lista omitía prioridad, fecha de resultado y adjuntos, y el error de alta aparecía en `alert`.
- Según `script.sql`, `dbo.Examen` contiene `IdExamen` (int), `IdConsulta` (int NULL), `NombreExamen` (nvarchar(200)), `FechaExamen` (datetime2), `FechaResultado` (date NULL), `Prioridad` (nvarchar(20) NULL), `IdDiagnostico` (int NULL) e `IdTurno` (int NULL). `ClinicaDbContext` mapea esas ocho propiedades y omite la propiedad CLR `Resultado`. `FechaResultado` no contiene resultados clínicos.
- `DB-AUDIT-AZURE-01/FINAL.md` deja constancia de que no hay identidad independiente de auditoría de solo lectura. Por ello **no se ejecutó SELECT remoto** y los tipos/restricciones de Azure SQL siguen sin verificarse directamente. No se usó `DefaultConnection` para auditar.
- La advertencia «La API devolvió datos descriptivos contradictorios» proviene de `ConsultaDetalleComponent.cargarEncabezado`: aparece cuando los datos relacionados recuperados de paciente, médico, sucursal o clínica no coinciden en ID, relación o nombre con la consulta. No se dispuso de respuesta real para atribuirla a un registro concreto; no se ocultó la advertencia ni se alteraron datos.

## Implementación

- Se incorporaron `GET/POST /api/examenes/{id}/archivos` y `GET/DELETE /api/examenes/{id}/archivos/{archivoId}`. JWT y el permiso `Historial/Consultar` protegen la lectura; `Historial/Modificar`, la carga; `Historial/Eliminar`, el borrado. El servicio valida existencia del examen, vínculo con consulta/diagnóstico y ámbito del médico activo antes de acceder a R2.
- El almacenamiento utiliza la configuración R2 existente y el prefijo `examenes/{idExamen}/{GUID}`. Cada objeto guarda en sus metadatos el nombre original saneado, SHA256, usuario y fecha UTC. No hay índice separado ni metadatos SQL. El `PUT` exige `If-None-Match: *`; el borrado usa ETag. Las cargas parciales conservan objetos autodescriptivos enumerables para conciliación, en vez de ocultar un éxito ambiguo.
- Se limitan las cargas a cuatro archivos por solicitud, 5 MiB por archivo y 20 MiB de contenido total. La API comprueba firma/formato real, extensión, decodificación y dimensiones de JPEG/PNG/WEBP. Para PDF se verifica estructura básica, referencias y fin de archivo. El nombre del cliente no determina la ruta de almacenamiento.
- La descarga es autenticada, con `Cache-Control: private, no-store`, `nosniff`, `Content-Disposition: attachment` y CSP `sandbox`. El frontend permite seleccionar, retirar, cargar con progreso, listar, ver, descargar y confirmar eliminación. La vista previa PDF usa un `blob:` creado localmente en `iframe sandbox`.
- La pestaña Exámenes incorpora nombre obligatorio, fecha, prioridad, listado descriptivo, detalle y estado de adjuntos. «Pendiente/Con resultados» se muestra **solo tras consultar los archivos** y representa existencia de adjuntos, no un estado clínico persistido. La fecha de resultado `DateOnly` se presenta sin desplazamiento de zona horaria.

## Archivos de este corte

- API: `API-Clinica/Controllers/ExamenesController.cs`, `API-Clinica/Services/ServiceCollectionExtensions.cs`, `API-Clinica/DTOs/ExamResultDtos.cs`, `API-Clinica/Interfaces/IExamResultService.cs`, `API-Clinica/Interfaces/IExamResultStorage.cs`, `API-Clinica/Services/ExamResultService.cs`, `API-Clinica/Services/CloudflareR2ExamResultStorage.cs`.
- Angular: `WebClinica/src/app/core/models/historial.model.ts`, `WebClinica/src/app/core/services/historial.service.ts`, `WebClinica/src/app/pages/historial/consulta-detalle.component.ts`, `WebClinica/src/app/pages/historial/exam-results.component.ts`.
- Pruebas: `API-Clinica.Tests/ExamenesTests.cs`, `WebClinica/src/app/core/services/historial.service.spec.ts`, `WebClinica/src/app/pages/historial/consulta-detalle-examenes.spec.ts`, `WebClinica/src/app/pages/historial/exam-results.component.spec.ts`.
- Respaldo de originales: `Respaldos-API-Clinica/WEB-EXA-R2-01/manifest.json`; siete archivos copiados y sus tamaños/SHA256 verificados nuevamente.

## Validación ejecutada

| Validación | Resultado |
| --- | --- |
| `dotnet restore API-Clinica/API-Clinica.csproj` | Correcto |
| `dotnet build API-Clinica/API-Clinica.csproj -c Release --no-restore` | Correcto, 0 advertencias y 0 errores |
| Pruebas aisladas `ExamenesTests`, `FotografiasTests`, `PhotoImageProcessorTests` | 37/37 aprobadas; almacenamiento R2 sustituido por fake en pruebas documentales |
| Pruebas Angular focalizadas | 30/30 aprobadas |
| Suite Angular completa | 1156/1156 aprobadas |
| `npm run verify` | Correcto |
| `npm run build -- --configuration production` | Correcto |
| `git diff --check` | Correcto; solo avisos de conversión LF/CRLF de Git |

## Riesgos y comprobaciones pendientes

1. **R2 real no probado en este corte.** No se creó, leyó ni eliminó un objeto de examen en `fotos-clinica`; la autorización anterior API-12I se refería a otro objeto y flujo. Se requiere una prueba sintética autorizada bajo `examenes/` antes de declarar completa la integración. Confirmar también que el bucket no tiene acceso público. La compatibilidad de `PutObject` con `If-None-Match` está documentada por [Cloudflare](https://developers.cloudflare.com/r2/api/s3/api/); el comportamiento concreto del borrado condicional exige prueba del bucket configurado.
2. **PDF:** la comprobación estructural es básica. No sustituye un parser PDF completo ni un análisis antimalware. Antes de aceptar documentos clínicos externos en producción, definir política de malware y retención.
3. **Esquema real:** se requiere el perfil de auditoría independiente de solo lectura previsto por DB-AUDIT-AZURE-02 para verificar `dbo.Examen` en Azure SQL. No se ejecutó ninguna escritura SQL ni migración.
4. **Interfaz en entorno integrado:** las pruebas Angular usan mocks; no se realizó una sesión navegador → API → R2 ni una inspección visual con datos sintéticos. La cantidad de adjuntos de una fila se conoce después de abrir/consultar ese examen; se evita lanzar una consulta R2 por cada fila de un historial grande.
5. Los exámenes vinculados **solo** por `IdDiagnostico` están autorizados por la API documental, pero el filtro actual del listado de esta pestaña consulta `IdConsulta` directo y no los muestra. Corregirlo requeriría definir el alcance del filtro GET de exámenes y pruebas de paginación específicas.

No se modificaron el esquema Azure SQL, fotografías, medicamentos, JWT, asignaciones RBAC ni CLOSE-13. No hubo commit, push ni despliegue.
