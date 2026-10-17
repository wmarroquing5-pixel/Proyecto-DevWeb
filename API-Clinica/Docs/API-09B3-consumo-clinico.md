# API-09B3: consumo clínico

> Actualización API-09B4B: el PUT de lotes exige ahora `cantidadEsperada` y
> compara el stock dentro de una transacción. La sección de riesgo inferior
> describe el estado histórico de API-09B3. Véase
> [API-09B4B-proteccion-stock.md](API-09B4B-proteccion-stock.md).

`POST /api/tratamientos/{id:int}/consumos` recibe exclusivamente `{"cantidad":2}`.
Exige JWT, usuario y rol activos, permiso dinámico `ConsumoClinico/Crear` y
que el usuario esté vinculado al médico activo de la consulta del tratamiento.
El lote, medicamento, usuario y sucursal se derivan del servidor. Un `201`
confirma el descuento y el movimiento `Uso Interno` en una transacción SQL
`Serializable`. La prescripción por `POST/PUT /api/tratamientos` sigue sin
descontar inventario.

El esquema no vincula el movimiento al tratamiento. Además, el PUT vigente
permite cambiar `Tratamiento.IdLote` después del consumo. El movimiento
conserva el lote efectivamente utilizado, pero no permite reconstruir desde
SQL qué tratamiento originó ese movimiento. Esta fase mantiene ese contrato.

## Habilitación administrativa

Un administrador con permiso `Permisos/Crear` debe crear para cada rol médico
autorizado un registro `Permiso` con `Modulo = "ConsumoClinico"` y
`PuedeCrear = true`, mediante `POST /api/permisos`. Si el registro ya existe,
actualizarlo con `PUT /api/permisos/{id}` usando `Permisos/Modificar`.
Los otros indicadores se definen según la política del rol; este endpoint
únicamente consulta `PuedeCrear`. Sin ese registro el acceso responde `403`.
Esta fase no insertó permisos en Azure SQL.

## Riesgo abierto: ajuste absoluto de lotes

`PUT /api/lotes-medicamento/{id}` acepta `CantidadDisponible` como valor
absoluto. Una solicitud que leyó una existencia anterior puede sobrescribir
un descuento confirmado después de esa lectura. El servicio comprueba que
no se cambie `IdMedicamento` de un lote ya referenciado por ventas o
tratamientos, pero esa validación no resuelve la sobrescritura del stock.
La comprobación de referencias del PUT tampoco forma una operación atómica
con una prescripción concurrente; debe reforzarse junto con el ajuste de
existencia en una fase que revise ese contrato.
Consumidores backend encontrados: `LotesMedicamentoController`, el DTO
`GuardarLoteMedicamentoRequest` y pruebas en `FarmaciaTests`. No se analizó
ni modificó el frontend.

Corrección propuesta para una fase aprobada: introducir una precondición de
existencia esperada en el PUT (campo o cabecera), bloquear el medicamento y
el lote en el mismo orden que ventas, comparar el valor esperado con el
actual dentro de una transacción y devolver `409` si difieren. Esto cambia
el contrato y las pruebas del PUT; no se aplicó en API-09B3. Sin una columna
de versión persistente tampoco puede detectarse un ciclo en que el stock
regrese exactamente al mismo valor. El ajuste concurrente queda como riesgo
no aceptado expresamente y API-09B permanece abierta.

El endpoint carece de clave de idempotencia por decisión API-08B5. Tras un
timeout, no se debe repetir automáticamente el POST sin comprobar primero
si se registró el consumo y su movimiento.
