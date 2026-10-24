# API-REC-IDEMP-01 — Resultado

**Alcance:** `POST /api/consultas/{idConsulta}/recetas`. Se auditó y corrigió únicamente el manejo de resultados transaccionales y bloqueos del servicio; el contrato REST, la autorización, el hash V3 y la escritura clínica permanecen iguales. Las pruebas SQL se ejecutaron en SQL Server Express local con datos sintéticos y bases efímeras `APIClinica_TratReceta_<GUID>`. No se conectó a Azure SQL.

## A. Idempotencia V3

La solicitud calcula `HashSolicitud` V3 antes de abrir una transacción `Serializable`. La consulta de `ClaveOperacion` usa `UPDLOCK, HOLDLOCK` y la restricción `UQ_RecetaClinica_Clave` actúa como última barrera. Igual clave y contenido devuelve la receta previa (`200`) con el mismo detalle; contenido diferente devuelve `409` sin nuevos registros. La creación nueva devuelve `201` solo después de confirmar el COMMIT. El detalle se construye **antes** del COMMIT, por lo que una lectura fallida aún permite rollback.

## B. Claves históricas

El hash V3 no se compara mediante reinterpretación de un contrato anterior. Una clave con hash anterior devuelve `409` y conserva intactos tratamiento, receta y líneas. La prueba relacional modificó solo el hash en su base sintética para verificar este caso.

## C. Concurrencia SQL

Dos POST simultáneos con la misma clave y contenido dejaron una receta y un tratamiento. Con contenido diferente dejaron una receta y el otro intento recibió `409`, directamente o tras reintentar un `503` con **la misma clave**. Dos claves distintas pudieron crear dos recetas independientes, de acuerdo con las restricciones existentes. Se comprobaron `Serializable`, bloqueo de clave, UNIQUE, rollback ante error de línea y ausencia de movimientos de inventario. Un bloqueo real provocado en la base temporal produjo el error SQL 1222, que EF envolvió en otra excepción: antes resultaba `500`; ahora se reconoce y devuelve `503`. El código también reconoce 1205 (deadlock), pero no se reprodujo un deadlock determinista, por lo que ese caso no se declara probado en SQL.

## D. Antes y después del COMMIT

Una falla inducida antes del COMMIT dejó cero tratamientos, recetas y líneas; la misma clave pudo crear la receta luego. Una excepción inducida después de que SQL confirmó produjo `503`, no `201`, aunque la receta ya existía; el reintento con la misma clave recuperó el original con `200` sin duplicar. La cancelación del cliente después del COMMIT también conservó una sola receta recuperable. Si `CommitAsync` lanza una excepción, el servidor no afirma que la transacción se confirmó ni que se revirtió.

## E–F. Problemas y correcciones

- El timeout SQL 1222 envuelto por EF escapaba al filtro de `SqlException` directo y terminaba en `500`. Se detecta 1205/1222 en la cadena de excepciones y se responde `503`, sin reintento automático que pudiera duplicar la operación.
- El resultado incierto de COMMIT no tenía una respuesta controlada. Se responde `503` con instrucción de conservar la clave de operación, y se registra la excepción para diagnóstico. La recuperación utiliza el POST existente con idéntico contenido; no se añadió endpoint.
- El resto de errores SQL no se convierte indiscriminadamente en `409`. El conflicto de clave/contenido, referencias inválidas y errores inesperados conservan sus categorías actuales. El manejador global sigue produciendo ProblemDetails y TraceId.

## G–H. Archivos y respaldo

Se modificaron `API-Clinica/Services/RecetaClinicaService.cs` y `API-Clinica.Tests/RecetaSqlIntegrationTests.cs`. Antes de editarlos se guardaron copias en `Respaldos-API-Clinica/API-REC-IDEMP-01/`, con tamaño, estado Git inicial y SHA-256 en `MANIFEST.json`; una segunda lectura confirmó ambos hashes:

| Original respaldado | Bytes | SHA-256 |
| --- | ---: | --- |
| `API-Clinica/Services/RecetaClinicaService.cs` | 13827 | `D5B22DFC6272F8E145002249B912C9BD53972C0487B5871A40119D5F6C70FC4F` |
| `API-Clinica.Tests/RecetaSqlIntegrationTests.cs` | 18595 | `CFD577C52D75509B56D41A4A33FD3B1A150B3B8DF952C4D2B2B09981C32B085E` |

## I–J. Validaciones

- `dotnet restore API-Clinica.Tests/API-Clinica.Tests.csproj`: correcto.
- Compilación Release de API y proyecto de pruebas: correctas, sin advertencias ni errores.
- Pruebas focalizadas de preparador, JSON, controlador y tratamientos: **41/41** aprobadas.
- `CLINICA_SQL_INTEGRATION=1`, `RecetaSqlIntegrationTests`: **12/12** aprobadas en SQL Server Express local. Incluyen HTTP, permisos, hash histórico, simultaneidad, integridad, fallas alrededor de COMMIT y stock/movimientos inalterados.
- Consulta de solo lectura a `master` después de las pruebas: **cero** bases con prefijo `APIClinica_TratReceta_` restantes. El fixture valida máquina, instancia, edición y nombre antes de crear o eliminar su base.
- `git diff --check`: correcto.

## K–L. Suite global y límites

La suite global no se declara aprobada: esta fase ejecutó solo los grupos afectados. Un caso SQL de otro módulo ejecutado sin `CLINICA_SQL_INTEGRATION=1` terminó con la señal de omisión dinámica del adaptador, antes de abrir SQL; no es evidencia de regresión de recetas. En el sandbox, testhost quedó sin respuesta; las pruebas focalizadas se repitieron fuera de ese aislamiento y finalizaron correctamente.

Los documentos `DB-TRAT-AUDIT-01/FINAL.md`, `API-REC-PERSIST-01`, `DB-REC-SIMPLE-02/VALIDACION.md` y `DB-REC-SIMPLE-03/RESULTADO.md` no estaban presentes en este checkout; se contrastó el código y el fixture SQL de recetas disponibles. El fixture reproduce en una base temporal el contrato simplificado con seis columnas nullable, mientras Azure SQL aún conserva esas columnas `NOT NULL`. Por ello estas pruebas **no** validan despliegue ni persistencia del contrato simplificado en producción. WebClinica sigue usando el contrato anterior y quedó fuera del alcance.

## M. Estado

**API-REC-IDEMP-01 validado en entorno aislado para los casos ejecutados.** Permanecen pendientes la prueba reproducible de deadlock, la suite global completa y la compatibilidad del esquema productivo antes de cualquier despliegue. No hubo migraciones, escrituras en Azure SQL, cambios de inventario productivo, commit ni despliegue.
