# API-09B4B: precondición de stock para actualizar lotes

## Problema y solución

Antes, `PUT /api/lotes-medicamento/{id}` recibía una existencia absoluta. Si
una venta, factura o consumo clínico confirmaba un descuento antes de que el
servidor atendiera un PUT basado en una lectura anterior del cliente, ese PUT
podía sobrescribir el descuento.

El PUT exige ahora `cantidadEsperada`: la existencia que observó el cliente
en `GET /api/lotes-medicamento/{id}`. La API compara ese valor con el actual
dentro de una transacción SQL `Serializable`. Bloquea los medicamentos
involucrados en orden ascendente y después el lote, compatible con el orden
de ventas, facturación y consumo clínico. El bloqueo exclusivo del lote
mantiene atómica la comprobación de referencias históricas al cambiar
`IdMedicamento`. El token de concurrencia EF de `CantidadDisponible` sigue
siendo una protección adicional. No se modificó el esquema SQL ni el
comportamiento del POST de lotes.

## Contrato REST

La ruta y respuesta exitosa se conservan. Ejemplo con stock observado 50:

```http
PUT /api/lotes-medicamento/12
Content-Type: application/json

{
  "idMedicamento": 5,
  "numeroLote": "L-123",
  "fechaIngreso": "2026-01-01",
  "fechaVencimiento": "2027-01-01",
  "cantidadDisponible": 45,
  "cantidadEsperada": 50
}
```

Si el stock vigente ya es 40, responde `409 Conflict` y no actualiza ningún
campo del lote. La respuesta `ProblemDetails` indica que se consulte el
stock actual. Si falta `cantidadEsperada`, es negativa, o la cantidad final
es negativa, responde `400`. El lote inexistente da `404`. JWT y permiso
dinámico `LotesMedicamento/Modificar` se mantienen. Una actualización válida
responde `200` con el lote actualizado.

El DTO de creación conserva su contrato. Los consumidores del PUT deben
enviar la nueva precondición; las solicitudes anteriores sin ella reciben
`400`. Se actualizaron los consumidores internos de pruebas. No se modificó
`WebClinica/`; su método `actualizarLote` aún apunta a `/Lotes/{id}` y no se
encontró una invocación desde los componentes actuales. Los clientes
externos, si existen, deberán adaptarse.

## Verificación

`dotnet restore` y `dotnet build --configuration Release` completaron con
0 errores y 0 advertencias. Nueve pruebas nuevas sobre bases SQL Server
sintéticas locales aprobaron: precondición válida e inválida, stock obsoleto,
dos ajustes simultáneos, coordinación con venta, factura y consumo clínico,
rollback, JWT y permisos. La suite completa terminó con 314 aprobadas,
2 omitidas y la misma falla conocida de Swagger (esperaba 200 y obtuvo 401).
No hubo regresiones nuevas frente a la línea base de 305 aprobadas, 2
omitidas y esa misma falla.

## Límites

Comparar únicamente la cantidad no descubre un ciclo en que el stock cambió
y luego regresó exactamente al valor observado. Sin una versión persistente
no se puede detectar ese caso. El PUT absoluto protegido tampoco crea un
movimiento de ajuste ni ofrece auditoría completa del cambio. Tras un
timeout, el cliente debe comprobar el resultado antes de reintentar.
