# WEB-TRAT-02 — Diseño de persistencia clínica y control de inventario

**Estado:** propuesta técnica, sin aprobación para implementar. **WEB-TRAT-01 continúa bloqueada.** Este documento no modifica el contrato de la API ni el esquema de Azure SQL. Las consultas de la sección 9 están preparadas, **no ejecutadas**.

## 1. Evidencia y supuestos que deben confirmarse

- Fuente documental: `C:\Users\DESARROLLO\Desktop\script.sql` (SHA256 `59AEA7DFC361E81FE865478D24F2750C40F2489F028B5EB5AD40847FD1FF19CB`), comparado con `WEB-TRAT-01/AUDITORIA.md`, las entidades, `ClinicaDbContext`, DTO, controladores y servicios actuales. `DB-AUDIT-AZURE-01/FINAL.md` registra que **no existe perfil independiente de metadatos de solo lectura**; el esquema remoto actual no quedó comprobado. No reutilizar `DefaultConnection` productiva para esta comprobación.
- `Diagnostico` tiene `IdDiagnostico` e `IdConsulta`; `Tratamiento` tiene `IdTratamiento`, `IdConsulta`, **un solo** `IdLote` y `Cantidad` opcionales. No hay FK entre diagnóstico y tratamiento. `Tratamiento.IdMedico` se deriva de `Consulta` y está ignorado por EF.
- `LoteMedicamento` vincula lote y medicamento y registra `CantidadDisponible`. `MovimientoInventario` tiene identidad, lote, usuario, sucursal, tipo, cantidad y fecha; no identifica tratamiento, receta, entrega ni administración. La restricción documentada de tipo admite `Entrada`, `Venta Publica`, `Uso Interno`, `Ajuste` y `Vencimiento`.
- `POST /api/tratamientos` guarda tratamiento sin descontar. `POST /api/tratamientos/{id}/consumos` recibe `cantidad`, exige `ConsumoClinico/Crear` y médico responsable, y registra un descuento y movimiento `Uso Interno` en una transacción serializable. Cada POST válido representa **otra salida**: carece de clave de idempotencia y no admite distinguir una administración de unidades ya entregadas.
- Las entidades C# `Venta`/`VentaDetalle` se mapean a `dbo.Factura`/`dbo.FacturaDetalle`; son operación comercial con precio y factura. Su reutilización como entrega clínica cambiaría semántica fiscal y no aportaría asociación inequívoca con receta. **No se propone reutilizarlas.** `Bitacora` narrativa no sustituye relaciones clínicas ni unicidad de operación.
- Los contratos de `Medicamento` no contienen presentación/unidad de dispensación estructurada. Dosis clínica (por ejemplo, mg) y unidades de inventario (por ejemplo, tabletas) requieren política de conversión explícita; no inferir equivalencias.

Las entidades anteriores reflejan el script y código, no una lectura del catálogo de Azure. Si la comprobación remota contradice estas fuentes, se revisará este diseño antes de cualquier implementación.

## 2. Invariantes funcionales comunes

1. La receta nace de **una consulta**, **un diagnóstico de esa misma consulta** y **un tratamiento** de esa consulta. El correlativo visual de diagnóstico jamás se persiste como ID.
2. Una receta puede tener varias líneas; cada línea conserva `IdMedicamento`, cantidad prescrita en **unidades de inventario definidas**, dosis, vía, frecuencia, duración, presentación e indicaciones. El lote se elige al entregar o administrar directamente, no al prescribir.
3. Prescribir **no** descuenta. Cada entrega confirmada descuenta exactamente la suma de sus líneas y deja una salida trazable. Cada administración directa desde stock descuenta una sola vez. Administrar unidades previamente entregadas o externas no vuelve a descontar.
4. `CantidadEntregada = suma de entregas confirmadas`; `CantidadAdministradaDesdeEntrega = suma de administraciones referidas a esas entregas`. Por cada línea de entrega, `administrada <= entregada`. Una entrega puede abastecer varias administraciones parciales.
5. Para impedir sobreabastecimiento, la propuesta cuenta como cumplimiento de la cantidad prescrita las entregas **más** las administraciones directas y, si la política clínica lo aprueba, las administraciones de origen externo. La administración desde una entrega no se suma de nuevo. La fórmula final debe ser aprobada antes de programar; no mostrar «pendiente» con una interpretación no aprobada.
6. Ninguna corrección borra eventos confirmados. Requiere motivo, actor, referencia al evento corregido y, si hay reintegro físico comprobado, movimiento compensatorio vinculado. Una anulación administrativa no repone stock por sí sola.
7. El backend valida JWT, permiso de operación, usuario activo, pertenencia de consulta/diagnóstico/tratamiento, lote y sucursal. Angular solo refleja esas decisiones; nunca es la autoridad del inventario.

## 3. Alternativa A — Solo estructuras actuales, sin cambios de esquema

| Capacidad | Garantía real con el contrato existente | Límite |
|---|---|---|
| Tratamiento | Un registro por consulta, descripción/indicaciones y, opcionalmente, un lote y cantidad. Su creación no descuenta. | No tiene `IdDiagnostico`; no atribuir a un diagnóstico concreto. |
| Medicación | Un `IdLote` por tratamiento permite indicar una cantidad de un medicamento. | No es una receta multilínea. Crear varios tratamientos no genera un agrupador persistente. |
| Salida clínica | El endpoint de consumos aplica stock y movimiento en una transacción serializable; se conoce el lote y usuario de cada movimiento. | No vincula movimiento con tratamiento; repetir la solicitud puede generar otra salida si hay stock. |
| Entrega parcial | Varias salidas independientes son posibles. | No hay entrega, receta ni saldo pendiente atribuible. No presentar esas salidas como entregas parciales. |
| Administración | Puede existir una evolución narrativa. | No registra de forma estructurada medicamento, origen, dosis, responsable y relación con salida. No usar el consumo para una administración ya descontada. |
| Consulta de historial | Se pueden consultar tratamientos y, según permisos existentes, movimientos por separado. | No se puede reconstruir una cadena receta → entrega → administración. |
| Estados | Tratamiento y movimientos existen. | `Pendiente`, `Parcialmente entregada`, `Entregada` y `Administrada` no son estados verificables del flujo solicitado. |

**Ventajas:** cero DDL, mínima superficie de regresión, conserva las garantías actuales de stock por salida. **Riesgos:** duplicados por reenvío, atribución clínica ambigua, imposibilidad de demostrar cantidades pendientes y administraciones sin segundo descuento. **Cambio admisible solo en una tarea de alcance reducido posterior:** mejorar la presentación de tratamientos de una línea y etiquetar explícitamente «consumo clínico: nueva salida»; no representa WEB-TRAT-01 completo. No se implementa aquí.

## 4. Alternativa B — Ampliación mínima conceptual para el flujo completo

**Esta alternativa contradice la prohibición actual de modificar el esquema y no está autorizada para ejecución.** Son entidades y restricciones conceptuales, no DDL operativo ni migración. Se prefiere conservar `Tratamiento`, `MovimientoInventario`, `LoteMedicamento` y sus registros históricos, y agregar estructuras especializadas. Los nombres son provisionales hasta cotejar Azure.

| Estructura propuesta | Campos/relaciones indispensables | Regla de integridad |
|---|---|---|
| `RecetaClinica` | `IdReceta`, `IdTratamiento` FK, `IdConsulta` FK, `IdDiagnostico` FK, `IdUsuarioPrescriptor` FK, `FechaPrescripcionUtc`, versión/estado controlado. | Un tratamiento de una consulta y un diagnóstico de **esa misma** consulta. Para evitar una relación cruzada desde otros escritores, valorar claves compuestas `(IdTratamiento, IdConsulta)` y `(IdDiagnostico, IdConsulta)` con índices candidatos; validar primero datos históricos. Una receta vigente por tratamiento/versión según política. |
| `RecetaLinea` | `IdRecetaLinea`, `IdReceta` FK, `IdMedicamento` FK, dosis, vía, frecuencia, duración, presentación/unidad de stock, `CantidadPrescritaUnidades`, indicaciones, orden. | Cantidad positiva; mismo medicamento puede aparecer en dos líneas solo si hay pauta distinta aprobada. No guardar el lote al prescribir. Pausas/cambios después de entregar requieren nueva versión o sustitución auditable, no sobrescritura. |
| `EntregaFarmacia` | `IdEntrega`, `IdReceta` FK, `ClaveOperacion` GUID único, `HashSolicitud`, `IdUsuarioResponsable` FK, `FechaConfirmacionUtc`, estado confirmado/corregido. | Una clave identifica **una** confirmación completa; mismo hash devuelve el resultado anterior, hash distinto con la misma clave responde `409`. No persistir una «confirmación» sin sus detalles y movimientos. |
| `EntregaDetalle` | `IdEntregaDetalle`, `IdEntrega` FK, `IdReceta` redundante para FK compuesta, `IdRecetaLinea` FK, `IdLote` FK, `CantidadEntregadaUnidades`. | La línea pertenece a la receta de la cabecera (comprobar con claves compuestas si el esquema aprobado lo permite); lote y medicamento coinciden; cantidad positiva y acumulado dentro del saldo permitido. Una entrega puede tener varias líneas/lotes. |
| `AdministracionClinica` | `IdAdministracion`, `IdRecetaLinea` FK, `ClaveOperacion` GUID único, `HashSolicitud`, `Origen` controlado (`InventarioDirecto`, `EntregaPrevia`, `Externo`), `IdEntregaDetalle` FK nullable, `IdLote` FK nullable, dosis, cantidad en unidades de stock, `FechaUtc`, `IdUsuarioResponsable` FK, observaciones. | Exactamente una ruta de origen: directa exige lote y salida; entrega previa exige detalle de entrega y **no** nueva salida; externa no usa stock interno. La entrega referida debe corresponder a la misma línea/medicamento (FK compuesta o validación transaccional y conciliación); suma administrada desde ella no supera lo entregado. |
| `SalidaClinica` | `IdSalidaClinica`, `IdMovimiento` FK único, `IdEntregaDetalle` FK nullable, `IdAdministracion` FK nullable. | Cada nueva salida clínica se asocia a **una y solo una** entrega o administración directa; unicidad sobre cada FK no nula y comprobación XOR. Cantidad y lote del movimiento deben coincidir con el evento y se comprueban dentro de la transacción y en conciliación. La relación no se codifica en `Observaciones`. Los movimientos históricos siguen sin atribución y no se imputan retrospectivamente. |
| `CorreccionClinica` | `IdCorreccion`, `ClaveOperacion` única, origen corregido (FK a entrega/administración según política), motivo, actor, fecha, estado, movimiento compensatorio FK nullable. | Sin borrado de eventos. Reintegro solo tras confirmar retorno físico, vigencia y lote; compensación transaccional y referencia única al movimiento original. Su flujo exacto requiere protocolo farmacéutico aprobado. |

`EntregaFarmacia` y `AdministracionClinica` son eventos independientes aunque compartan receta. El campo `IdReceta` de la entrega puede agrupar varias líneas de la misma receta; `IdTratamiento` y `IdDiagnostico` se obtienen por FK, sin duplicar texto. `Tratamiento.IdLote/Cantidad` se preservan para registros legados; los tratamientos nuevos con receta multilínea no deberían usar esos campos como segunda fuente de cantidad. Una receta no puede convertirse en factura ni viceversa.

**Ventajas:** vínculos explícitos, varias líneas, saldo calculable, origen de administración comprobable, idempotencia persistente y auditoría del movimiento. **Coste/riesgos:** nuevas estructuras e índices, permisos/contratos nuevos, plan de despliegue y reversión, validación de datos legados, mayor complejidad de bloqueo y riesgo de conciliación. No es compatible con la regla vigente de Azure SQL inmutable; una aprobación futura tendría que cambiar expresamente esa restricción y pasar por revisión DBA/clínica/seguridad.

### Cantidades y estados derivados

Para cada `RecetaLinea`, con solo eventos **confirmados y no compensados**:

```text
prescrita = CantidadPrescritaUnidades
entregada = SUM(EntregaDetalle.CantidadEntregadaUnidades)
administradaDesdeEntrega = SUM(AdministracionClinica.Cantidad WHERE Origen = EntregaPrevia)
administradaDirecta = SUM(AdministracionClinica.Cantidad WHERE Origen = InventarioDirecto)
administradaExterna = SUM(AdministracionClinica.Cantidad WHERE Origen = Externo)
disponibleDesdeEntrega = entregada - administradaDesdeEntrega          >= 0
pendientePorSuministrar = prescrita - entregada - administradaDirecta
                       - externaQueCumpleRecetaSegunPolitica           >= 0
```

No restar `administradaDesdeEntrega` dos veces del saldo de prescripción: esas unidades ya figuran en `entregada`. `Pendiente`/`Parcialmente entregada`/`Entregada` se derivan de cantidades confirmadas; «Administrada» corresponde a eventos de administración, no al estado de la receta. `Cancelada`, `Omitida` y correcciones necesitan causa, permisos y política de transición aprobados. Si el tratamiento puede prescribirse en unidades clínicas distintas de las unidades de stock, bloquear confirmación hasta definir conversión y redondeo validados.

## 5. Transacciones, idempotencia y recuperación

1. **Prescribir:** validar consulta abierta/estado permitido, médico responsable, diagnóstico de la consulta, líneas y medicamento activo; guardar cabecera y líneas en una transacción. No tocar stock. El control de edición y versionado se define antes de permitir entregas.
2. **Entregar:** recibir una `ClaveOperacion` generada una vez por confirmación y un hash canónico del contenido. Dentro de **una transacción SQL**: verificar si la clave ya existe; si existe con el mismo hash, devolver el resultado confirmado; si difiere, `409`. Bloquear receta/líneas, medicamento y lotes en orden estable compatible con ventas; calcular saldos; comprobar lote vigente, sucursal, stock y cantidad; efectuar decremento condicional, guardar entrega/detalles, movimientos y vínculos `SalidaClinica`; confirmar juntos. Un índice único de clave protege también dos solicitudes simultáneas que superen la comprobación inicial. Si cualquier paso falla, revertir todo.
3. **Administrar desde stock:** misma estrategia de clave, transacción, lote y salida única; registrar administración, descuento, movimiento y vínculo. **Administrar desde entrega:** bloquear el detalle de entrega, comprobar unidades disponibles, guardar solo administración; **no** insertar movimiento ni decrementar stock. **Origen externo:** guardar administración sin lote interno ni movimiento, con procedencia verificable y política clínica aprobada.
4. **Concurrencia:** serializar los saldos de la línea/entrega y bloquear medicamento→lote en orden coherente con los servicios existentes. Combinar la comprobación del saldo con unicidad de clave y decremento condicionado `CantidadDisponible >= cantidad`; la comprobación previa en memoria no basta. SQL Server documenta que `SERIALIZABLE` protege rangos leídos, pero puede aumentar el bloqueo; las restricciones únicas son la última barrera frente a duplicados ([bloqueos](https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-transaction-locking-and-row-versioning-guide), [índices únicos filtrados](https://learn.microsoft.com/en-us/sql/relational-databases/indexes/create-filtered-indexes)). Validar el orden exacto y sus índices con pruebas SQL aisladas.
5. **Timeout posterior a commit:** el cliente consulta la operación por clave; no genera otra clave ni reenvía a ciegas. Repetir con la **misma** clave y cuerpo puede recuperar la respuesta persistida. Un deadlock `1205` exige resolver primero si la transacción se confirmó y, si se reintenta, hacerlo sobre la transacción completa con la misma clave ([guía de deadlocks](https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-deadlocks-guide)). Coordinar las transacciones explícitas con la estrategia de reintentos EF Core y evitar asumir que `SaveChanges` de varias fases crea una sola operación atómica sin transacción externa ([EF Core](https://learn.microsoft.com/en-us/ef/core/saving/transactions)).
6. **Conciliación:** reportar entregas/administraciones confirmadas sin movimiento requerido, movimientos nuevos sin `SalidaClinica`, doble vínculo, divergencia de cantidad/lote, stock negativo y administraciones mayores que entregas. No inferir enlaces para movimientos legados. La reparación exige evento correctivo auditable, nunca edición silenciosa.

## 6. Seguridad, API y WebClinica propuestos para B

| Operación | Permiso propuesto, separado | Validación adicional | Contrato conceptual (sin implementación) |
|---|---|---|---|
| Leer receta y trazabilidad | `Prescripcion/Consultar`, según ámbito clínico | Consulta/paciente/médico o política de acceso aprobada | `GET /api/recetas?consulta=...`, `GET /api/recetas/{id}` |
| Prescribir/corregir pauta | `Prescripcion/Crear` y `Prescripcion/Modificar` separados | Médico responsable activo; diagnóstico y tratamiento de misma consulta; edición bloqueada tras suministro salvo versión/corrección | `POST /api/recetas`, versión explícita |
| Confirmar entrega | `EntregaFarmacia/Crear` | Personal farmacéutico autorizado, sucursal/lote/stock/saldo; clave de operación | `POST /api/recetas/{id}/entregas`; consulta por ID/clave |
| Registrar administración | `AdministracionClinica/Crear` | Personal clínico autorizado; fuente demostrada; saldo por entrega o stock directo | `POST /api/recetas/{id}/administraciones`; consulta por ID/clave |
| Consultar historial/corregir | `EntregaFarmacia/Consultar`, `AdministracionClinica/Consultar`; modificación/corrección con permiso específico | Auditoría y atribución mínima necesaria; dos personas si política lo exige | GET paginados y operación correctiva explícita |

Los nombres de módulos son **propuestas**: no se cambian las 67 asignaciones RBAC ni se concede nada implícitamente por `Historial/Crear` o `ConsumoClinico/Crear`. Los nuevos controladores/servicios/DTO y mapeos EF necesitarían contratos versionados, ProblemDetails (`400`, `401`, `403`, `404`, `409`) y pruebas de pertenencia, confidencialidad, concurrencia e idempotencia. El endpoint actual `POST /api/tratamientos/{id}/consumos` **permanece intacto en esta fase** y no se usa como entrega ni como administración de unidades ya descontadas. Antes de un eventual despliegue B, se debe impedir que el `PUT` legado asigne `IdLote/Cantidad` a un tratamiento con receta nueva y que el consumo legado procese ese tratamiento; conservar su funcionamiento para registros históricos. Ese control futuro necesita contrato y pruebas propios.

En WebClinica, una tarea posterior mostraría: selector de diagnóstico con correlativo e ID real; formulario de receta multilínea; sección farmacia con saldo, lotes y confirmación; sección administración con origen explícito; historial de operaciones. Cada acción se oculta según permiso, pero el backend vuelve a autorizar. Las respuestas deben proporcionar IDs de operación, cantidades y estados derivados; nunca calcular historial persistente solo en memoria del navegador. No cambiar la vista durante esta fase.

## 7. Matriz de compatibilidad

| Requisito WEB-TRAT-01 | A: esquema actual | B: ampliación propuesta |
|---|---|---|
| Diagnóstico específico por receta | No | Sí, FK y comprobación de misma consulta |
| Varios medicamentos en una receta | No | Sí, `RecetaLinea` |
| Prescribir sin descontar | Sí | Sí |
| Entregas completas/parciales con saldo | No | Sí, eventos y acumulados por línea |
| Administración directa / entregada / externa | No | Sí, origen explícito y relación de suministro |
| Cada salida vinculada a su origen | No | Sí, `SalidaClinica` para nuevos eventos |
| Idempotencia persistente | No | Sí, clave única + hash + respuesta recuperable |
| No descontar dos veces | Solo para una transacción individual; no ante reenvío | Sí, con unicidad, vínculo y transacciones probadas |
| Concurrencia de stock | Sí para consumos independientes existentes | Sí, ampliada a saldos de receta/entrega y stock |
| Historial auditable por receta | No | Sí, eventos y correcciones vinculados |
| Sin modificar Azure SQL | Sí | **No; requiere autorización que hoy no existe** |

## 8. Puertas de decisión antes de una eventual implementación

1. Disponer de identidad de auditoría con visibilidad de metadatos y sin lectura de filas clínicas ni escritura; ejecutar sección 9 y cotejar con el script. Un resultado oculto por permisos es **no verificable**, no «ausente» ([visibilidad de metadatos](https://learn.microsoft.com/en-us/sql/relational-databases/security/metadata-visibility-configuration)).
2. Aprobar política clínica de unidad de dispensación/conversión, receta por tratamiento, versiones, cumplimiento por fuente externa, cancelación, administración parcial, corrección y retención.
3. Si se elige B, cambiar **expresamente** la prohibición vigente de DDL mediante decisión separada del dueño de datos; revisar impacto, respaldo, despliegue/reversión y permisos con DBA. Este documento no concede esa autorización.
4. Implementar por cortes independientes: contrato/relaciones → receta multilínea sin stock → entrega transaccional e idempotente → administración según origen → correcciones e historial → UI; cada corte con pruebas SQL Server **aisladas**, nunca sobre Azure productiva. Conservar y ejecutar la suite anterior en cada corte.

**Recomendación:** A es la única compatible hoy con la inmutabilidad de Azure, pero **no satisface** WEB-TRAT-01 y no debe maquillarse como entrega/administración. B es la propuesta para cumplir el flujo completo, condicionada a cambio expreso de la regla de esquema, comprobación remota y política clínica aprobada. Mantener WEB-TRAT-01 bloqueada. La batería mínima futura debe incluir dos entregas simultáneas sobre la misma línea, reenvío con clave igual/cuerpo igual y clave igual/cuerpo distinto, timeout tras commit, agotamiento de stock, lote vencido, dos administraciones concurrentes de una misma entrega, administración externa sin movimiento, reversión con y sin reintegro físico, permisos cruzados y conciliación de movimiento/evento.

## 9. Consultas preparadas de solo lectura — NO EJECUTAR AÚN

Estas consultas leen **metadatos**, no filas de pacientes ni movimientos. Ejecutarlas únicamente tras verificar una identidad específica de auditoría, el destino esperado y permisos efectivos. No ejecutar con `DefaultConnection` productiva. `sys.*` puede ocultar objetos por falta de permisos; ante visibilidad insuficiente, detener la comparación. Las vistas de catálogo y `HAS_PERMS_BY_NAME` están documentadas por Microsoft ([catálogos](https://learn.microsoft.com/en-us/sql/relational-databases/system-catalog-views/object-catalog-views-transact-sql), [visibilidad](https://learn.microsoft.com/en-us/sql/relational-databases/security/metadata-visibility-configuration)).

**9.1 Identidad, destino y puerta de permisos.** Contrastar servidor/base con los valores aprobados fuera del informe. Si cualquier permiso de escritura/DDL es `1`, si un rol amplio está activo, si el resultado es `NULL` o si falta visibilidad, suspender. No imprimir la cadena de conexión.

```sql
SELECT DB_NAME() AS BaseActual,
       SUSER_SNAME() AS IdentidadServidor,
       USER_NAME() AS IdentidadBase,
       SERVERPROPERTY('EngineEdition') AS EdicionMotor,
       SERVERPROPERTY('ProductVersion') AS VersionMotor,
       IS_MEMBER(N'db_owner') AS DbOwner,
       IS_MEMBER(N'db_ddladmin') AS DbDdlAdmin,
       IS_MEMBER(N'db_securityadmin') AS DbSecurityAdmin,
       IS_MEMBER(N'db_accessadmin') AS DbAccessAdmin,
       IS_MEMBER(N'db_datareader') AS DbDataReader,
       IS_MEMBER(N'db_datawriter') AS DbDataWriter,
       HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'VIEW DEFINITION') AS PuedeVerDefinicion,
       HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'ALTER') AS PuedeAlterarBase,
       HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'CONTROL') AS PuedeControlarBase;

SELECT v.Objeto,
       HAS_PERMS_BY_NAME(v.Objeto, N'OBJECT', N'VIEW DEFINITION') AS VerDefinicion,
       HAS_PERMS_BY_NAME(v.Objeto, N'OBJECT', N'SELECT') AS LeerFilas,
       HAS_PERMS_BY_NAME(v.Objeto, N'OBJECT', N'INSERT') AS Insertar,
       HAS_PERMS_BY_NAME(v.Objeto, N'OBJECT', N'UPDATE') AS Actualizar,
       HAS_PERMS_BY_NAME(v.Objeto, N'OBJECT', N'DELETE') AS Eliminar,
       HAS_PERMS_BY_NAME(v.Objeto, N'OBJECT', N'ALTER') AS Alterar,
       HAS_PERMS_BY_NAME(v.Objeto, N'OBJECT', N'CONTROL') AS Controlar
FROM (VALUES (N'dbo.Consulta'), (N'dbo.Diagnostico'), (N'dbo.Tratamiento'),
             (N'dbo.Medicamento'), (N'dbo.LoteMedicamento'),
             (N'dbo.MovimientoInventario'), (N'dbo.Factura'),
             (N'dbo.FacturaDetalle'), (N'dbo.Permiso'), (N'dbo.Bitacora')) AS v(Objeto);
```

**9.2 Tablas y columnas.** Incluye nombres conceptuales de B para comprobar si Azure ya contiene alguna estructura equivalente; su ausencia solo puede declararse con visibilidad completa.

```sql
SELECT s.name AS Esquema, t.name AS Tabla, t.object_id AS ObjectId
FROM sys.tables AS t
JOIN sys.schemas AS s ON s.schema_id = t.schema_id
WHERE s.name = N'dbo'
  AND t.name IN (N'Consulta', N'Diagnostico', N'Tratamiento', N'Medicamento',
                 N'LoteMedicamento', N'MovimientoInventario', N'Factura',
                 N'FacturaDetalle', N'Bitacora', N'Permiso', N'RecetaClinica',
                 N'RecetaLinea', N'EntregaFarmacia', N'EntregaDetalle',
                 N'AdministracionClinica', N'SalidaClinica', N'CorreccionClinica')
ORDER BY t.name;

SELECT s.name AS Esquema, t.name AS Tabla, c.column_id, c.name AS Columna,
       ty.name AS TipoSql, c.max_length AS LongitudBytes, c.precision, c.scale,
       c.is_nullable, c.is_identity, dc.definition AS DefaultDefinicion
FROM sys.tables AS t
JOIN sys.schemas AS s ON s.schema_id = t.schema_id
JOIN sys.columns AS c ON c.object_id = t.object_id
JOIN sys.types AS ty ON ty.user_type_id = c.user_type_id
LEFT JOIN sys.default_constraints AS dc ON dc.object_id = c.default_object_id
WHERE s.name = N'dbo'
  AND t.name IN (N'Consulta', N'Diagnostico', N'Tratamiento', N'Medicamento',
                 N'LoteMedicamento', N'MovimientoInventario', N'Factura',
                 N'FacturaDetalle', N'Bitacora', N'Permiso', N'RecetaClinica',
                 N'RecetaLinea', N'EntregaFarmacia', N'EntregaDetalle',
                 N'AdministracionClinica', N'SalidaClinica', N'CorreccionClinica')
ORDER BY t.name, c.column_id;
```

**9.3 Relaciones reales.** Verificar en particular diagnóstico/consulta, tratamiento/consulta, tratamiento/lote y movimiento/lote/usuario/sucursal; buscar cualquier FK adicional no presente en el script.

```sql
SELECT fk.name AS FK, ps.name AS EsquemaOrigen, pt.name AS TablaOrigen,
       pc.name AS ColumnaOrigen, rs.name AS EsquemaDestino,
       rt.name AS TablaDestino, rc.name AS ColumnaDestino,
       fkc.constraint_column_id, fk.is_disabled, fk.is_not_trusted
FROM sys.foreign_keys AS fk
JOIN sys.foreign_key_columns AS fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.tables AS pt ON pt.object_id = fk.parent_object_id
JOIN sys.schemas AS ps ON ps.schema_id = pt.schema_id
JOIN sys.columns AS pc ON pc.object_id = pt.object_id AND pc.column_id = fkc.parent_column_id
JOIN sys.tables AS rt ON rt.object_id = fk.referenced_object_id
JOIN sys.schemas AS rs ON rs.schema_id = rt.schema_id
JOIN sys.columns AS rc ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id
WHERE ps.name = N'dbo' AND pt.name IN
      (N'Consulta', N'Diagnostico', N'Tratamiento', N'LoteMedicamento',
       N'MovimientoInventario', N'Factura', N'FacturaDetalle', N'Bitacora',
       N'RecetaClinica', N'RecetaLinea', N'EntregaFarmacia',
       N'EntregaDetalle', N'AdministracionClinica', N'SalidaClinica',
       N'CorreccionClinica')
ORDER BY pt.name, fk.name, fkc.constraint_column_id;
```

**9.4 Índices, unicidad y restricciones.** Verificar identidades existentes, límites de stock/cantidad, valores permitidos de movimiento, posibles claves de operación y ausencia/presencia de unicidad. No asumir que un índice visto en EF está desplegado.

```sql
SELECT s.name AS Esquema, t.name AS Tabla, i.name AS Indice,
       i.is_unique, i.is_primary_key, i.has_filter, i.filter_definition,
       ic.key_ordinal, c.name AS Columna
FROM sys.tables AS t
JOIN sys.schemas AS s ON s.schema_id = t.schema_id
JOIN sys.indexes AS i ON i.object_id = t.object_id
LEFT JOIN sys.index_columns AS ic ON ic.object_id = i.object_id
                                  AND ic.index_id = i.index_id
                                  AND ic.is_included_column = 0
LEFT JOIN sys.columns AS c ON c.object_id = ic.object_id
                          AND c.column_id = ic.column_id
WHERE s.name = N'dbo'
  AND t.name IN (N'Diagnostico', N'Tratamiento', N'LoteMedicamento',
                 N'MovimientoInventario', N'FacturaDetalle', N'RecetaClinica',
                 N'RecetaLinea', N'EntregaFarmacia', N'EntregaDetalle',
                 N'AdministracionClinica', N'SalidaClinica', N'CorreccionClinica')
ORDER BY t.name, i.name, ic.key_ordinal;

SELECT s.name AS Esquema, t.name AS Tabla, ck.name AS Restriccion,
       ck.definition, ck.is_disabled, ck.is_not_trusted
FROM sys.check_constraints AS ck
JOIN sys.tables AS t ON t.object_id = ck.parent_object_id
JOIN sys.schemas AS s ON s.schema_id = t.schema_id
WHERE s.name = N'dbo'
  AND t.name IN (N'Tratamiento', N'LoteMedicamento', N'MovimientoInventario',
                 N'FacturaDetalle', N'RecetaClinica', N'RecetaLinea',
                 N'EntregaFarmacia', N'EntregaDetalle',
                 N'AdministracionClinica', N'SalidaClinica', N'CorreccionClinica')
ORDER BY t.name, ck.name;

SELECT s.name AS Esquema, t.name AS Tabla, kc.name AS Clave,
       kc.type_desc AS TipoClave, kc.is_system_named
FROM sys.key_constraints AS kc
JOIN sys.tables AS t ON t.object_id = kc.parent_object_id
JOIN sys.schemas AS s ON s.schema_id = t.schema_id
WHERE s.name = N'dbo'
  AND t.name IN (N'Diagnostico', N'Tratamiento', N'LoteMedicamento',
                 N'MovimientoInventario', N'FacturaDetalle', N'RecetaClinica',
                 N'RecetaLinea', N'EntregaFarmacia', N'EntregaDetalle',
                 N'AdministracionClinica', N'SalidaClinica', N'CorreccionClinica')
ORDER BY t.name, kc.name;
```

**Ejecución registrada en WEB-TRAT-02:** ninguna consulta; ningún dato clínico leído; ninguna operación productiva; ningún cambio de esquema, código, RBAC, inventario o despliegue.
