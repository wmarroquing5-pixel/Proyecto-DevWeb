# WEB-TRAT-03 — Diseño final propuesto de persistencia clínica

**Estado:** diseño para revisión; no es contrato implementado ni autorización de DDL. `WEB-TRAT-01` sigue bloqueado. Las siete estructuras de este documento son **nuevas y propuestas**; ninguna está creada. La regla vigente de `AGENTS.md` y `database-contract` mantiene Azure SQL inmutable. Implementarlas exigiría una excepción expresa, separada y posterior.

## 1. Evidencia y límites

La comparación usa [`WEB-TRAT-01/AUDITORIA.md`](../WEB-TRAT-01/AUDITORIA.md), [`WEB-TRAT-02/DISENO.md`](../WEB-TRAT-02/DISENO.md), [`DB-AUDIT-AZURE-02/FINAL.md`](../DB-AUDIT-AZURE-02/FINAL.md), el `script.sql` local del usuario (`C:\Users\DESARROLLO\Desktop\script.sql`, SHA256 `59AEA7DFC361E81FE865478D24F2750C40F2489F028B5EB5AD40847FD1FF19CB`) y entidades, mapeo, DTO y servicios actuales. El script es una referencia documental y no certifica por sí solo Azure SQL. Los metadatos remotos de `db_Clinica` fueron obtenidos **por el usuario en SSMS** con `aud_empresa`; Codex no se conectó a Azure ni inspeccionó filas clínicas. La auditoría reporta 27 tablas `dbo`, 36 columnas de cinco tablas complementarias y 28 registros de FK/índices/CHECK/DEFAULT. En `dbo.Bitacora` existe solo el índice clustered de PK; el índice `IX_Bitacora_Tabla_Fecha` declarado por EF no existe remotamente según esa comprobación SSMS. No se propone corregirlo aquí.

`Tratamiento` posee `IdConsulta`, un `IdLote` nullable y `Cantidad` nullable, sin `IdDiagnostico`. `MovimientoInventario` carece de referencia a receta, entrega o administración y de clave de idempotencia. `LoteMedicamento` conserva stock por lote. `FacturaDetalle` es comercial; `HistorialMedico` es narrativo; `Bitacora` no aporta FK clínica. La columna `Medicamento.Presentacion` figura en el script y como propiedad sombra EF, pero no define una unidad de dispensación/conversión validada en los DTO. Quedan pendientes las definiciones remotas completas de longitudes/precisión y la búsqueda exhaustiva de estructuras equivalentes con otros nombres (véase la auditoría).

El contrato vigente `POST /api/tratamientos/{id:int}/consumos` descuenta en transacción serializable y crea un movimiento `Uso Interno` por cada solicitud válida, sin idempotencia; no representa una entrega de farmacia ni una administración de unidades ya entregadas. El `PUT /api/tratamientos/{id}` puede cambiar `IdLote/Cantidad`. Ambos deben conservarse para legados y quedar excluidos de tratamientos gobernados por receta nueva en una futura implementación.

## 2. Modelo lógico e invariantes

```text
Consulta (IdPaciente, IdMedico, IdSucursal)
  ├─ Diagnostico (misma IdConsulta)
  └─ Tratamiento (misma IdConsulta)
       └─ RecetaClinica (diagnóstico específico, versión, autor)
            └─ RecetaLinea (medicamento y pauta; sin lote)
                 ├─ EntregaDetalle → EntregaFarmacia (lote, cantidad)
                 │    └─ AdministracionClinica [EntregaPrevia; sin nueva salida]
                 └─ AdministracionClinica [InventarioDirecto | Externo]
SalidaClinica → MovimientoInventario, con origen exclusivo EntregaDetalle o Administración directa
CorreccionClinica → evento original, motivo, autor y eventual movimiento compensatorio
```

`IdPaciente` y `IdMedico` se obtienen de `Consulta`; `IdUsuarioPrescriptor` identifica además al actor autenticado. El número correlativo visible del diagnóstico se calcula de forma determinista en la consulta y **no** sustituye `IdDiagnostico`. Una receta se asocia a un diagnóstico real de esa misma consulta y a un tratamiento real de esa consulta. Una receta necesita una o más líneas. Prescribir no altera inventario. La línea no fija lote: el lote se elige en la salida.

Cada cantidad se expresa como entero de **unidades descontables del lote**, con `UnidadInventario` explícita en la línea y validada por política de producto. Dosis clínica y cantidad de inventario son conceptos distintos; no se convierte `mg` a tabletas, ampollas o ml a partir de texto libre. Hasta aprobar un catálogo/conversión segura, se deben bloquear prescripciones cuya equivalencia en unidades de lote no pueda verificarse. `Presentacion` existente puede mostrarse, pero no se presume factor de conversión.

Para una línea vigente: `entregado = Σ EntregaDetalle confirmados no compensados`; `directo = Σ AdministracionClinica(InventarioDirecto) confirmadas no compensadas`; `pendiente = max(0, prescrito - entregado - directo)`. La administración desde entrega consume saldo **de esa EntregaDetalle**: `administradoDesdeEntrega <= entregadoEnDetalle`; no vuelve a reducir `pendiente` ni el stock. Lo externo se registra y muestra aparte; **no** se descuenta ni reduce el pendiente hasta que una política clínica apruebe que satisface una prescripción interna. Estas fórmulas requieren la política de correcciones y de versiones de §5 antes de programar.

Las consultas `Cerrada` no deben aceptar nuevas recetas/entregas/administraciones sin una política explícita de continuidad; `NULL` histórico no equivale a `Abierta`. La API debe validar estado, paciente, médico responsable, diagnóstico, tratamiento, sucursal, lote, usuario activo y permiso en cada operación. No hay concesión implícita por rol o por los permisos `Historial` y `ConsumoClinico` actuales.

## 3. Esquema mínimo propuesto (SQL Server; no ejecutado)

Convenciones de diseño: PK `int IDENTITY`, FK `int` con `ON DELETE NO ACTION`, fechas `datetime2(3)` en UTC generadas por servidor/API, cantidades enteras positivas; índices con nombres orientativos. Ningún `DEFAULT` de estado, actor, lote o cantidad para evitar eventos inventados. Los `DEFAULT` enumerados son **propuestas**. No se agregan columnas a tablas existentes. Los FK individuales aseguran existencia; la pertenencia cruzada a la misma consulta o receta requiere además verificación transaccional en C#; para garantizarla solo con SQL harían falta claves compuestas únicas en tablas existentes, incompatibles con la prohibición actual. Ningún otro escritor podrá saltarse esas validaciones si se pretende la garantía completa.

### 3.1 `RecetaClinica` — cabecera y versión

| Columna | Tipo / NULL | Regla |
|---|---|---|
| `IdReceta` | `int IDENTITY NOT NULL` | PK. |
| `IdTratamiento` | `int NOT NULL` | FK a `Tratamiento`. |
| `IdDiagnostico` | `int NOT NULL` | FK a `Diagnostico`. |
| `IdUsuarioPrescriptor` | `int NOT NULL` | FK a `Usuario`; debe corresponder al médico autorizado. |
| `IdRecetaAnterior` | `int NULL` | FK propia para sustitución/versionado. |
| `NumeroVersion` | `int NOT NULL` | CHECK `>= 1`; primera versión 1. |
| `Estado` | `nvarchar(20) NOT NULL` | CHECK de valores aprobados (`Vigente`, `Sustituida`, `Anulada` propuestos); sin DEFAULT. |
| `FechaPrescripcionUtc` | `datetime2(3) NOT NULL` | Momento inmutable. |
| `ClaveOperacion`, `HashSolicitud` | `uniqueidentifier NOT NULL`, `binary(32) NOT NULL` | Idempotencia de creación. |

Índices/UNIQUE: `UQ_Receta_ClaveOperacion`, `UQ_Receta_Tratamiento_Version (IdTratamiento, NumeroVersion)`, índice `(IdDiagnostico, FechaPrescripcionUtc)` y UNIQUE filtrado por `Estado='Vigente'` sobre `IdTratamiento` si se aprueba **una** versión vigente por tratamiento. `IdRecetaAnterior` debe pertenecer al mismo tratamiento y tener versión inferior; comprobarlo en transacción. No se duplica `IdConsulta`, paciente ni médico: se obtiene de Tratamiento/Diagnostico/Consulta y se exige coincidencia. Un cambio posterior de `Consulta.IdPaciente/IdMedico` o `Tratamiento.IdConsulta` debe rechazarse para registros gobernados; el servicio vigente ya impide cambiar `Tratamiento.IdConsulta`, pero debe auditarse `Consulta` al implementar.

### 3.2 `RecetaLinea` — varios medicamentos y pauta

| Columna | Tipo / NULL | Regla |
|---|---|---|
| `IdRecetaLinea`, `IdReceta`, `IdMedicamento` | `int IDENTITY NOT NULL`, `int NOT NULL`, `int NOT NULL` | PK y FK a cabecera/medicamento. |
| `Orden`, `CantidadPrescritaUnidades` | `smallint NOT NULL`, `int NOT NULL` | CHECK `> 0`; UNIQUE `(IdReceta, Orden)`. |
| `UnidadInventario`, `UnidadDosis`, `Via`, `Frecuencia` | `nvarchar(30) NOT NULL`, `nvarchar(30) NOT NULL`, `nvarchar(40) NOT NULL`, `nvarchar(100) NOT NULL` | Catálogos/valores aprobados por API; no equivalencias inferidas. |
| `Dosis` | `decimal(12,3) NOT NULL` | CHECK `> 0`; precisión sujeta a farmacología. |
| `DuracionDias` | `smallint NOT NULL` | CHECK `> 0`; excepciones requieren política. |
| `Indicaciones` | `nvarchar(500) NULL` | Texto complementario, no identidad ni conversión. |

Índices: `(IdReceta, Orden) UNIQUE`, `(IdMedicamento)`. Las líneas confirmadas son inmutables; no se reemplaza una pauta editando el mismo registro. Dos líneas del mismo medicamento se permiten solo si la pauta lo justifica explícitamente y pasan validación clínica; no se fusionan por nombre. `IdLote` no se guarda aquí.

### 3.3 `EntregaFarmacia` — confirmación independiente

| Columna | Tipo / NULL | Regla |
|---|---|---|
| `IdEntrega`, `IdReceta`, `IdUsuarioResponsable` | `int IDENTITY NOT NULL`, `int NOT NULL`, `int NOT NULL` | PK y FK a receta/usuario. |
| `FechaConfirmacionUtc` | `datetime2(3) NOT NULL` | Inmutable tras confirmación. |
| `ClaveOperacion`, `HashSolicitud` | `uniqueidentifier NOT NULL`, `binary(32) NOT NULL` | UNIQUE en clave; mismo contenido retorna el evento original. |

Índices: `UQ_Entrega_ClaveOperacion`, `(IdReceta, FechaConfirmacionUtc)`. La cabecera y al menos un detalle se confirman con movimientos en **una** transacción. No se guarda una cabecera huérfana confirmada. El estado `parcial/completa` se deriva del saldo bajo la política aprobada, no de un campo mutable.

### 3.4 `EntregaDetalle` — cantidad y lote por línea

| Columna | Tipo / NULL | Regla |
|---|---|---|
| `IdEntregaDetalle`, `IdEntrega`, `IdRecetaLinea`, `IdLote` | `int IDENTITY NOT NULL`, tres `int NOT NULL` | PK y FK a entrega, línea y lote. |
| `CantidadEntregadaUnidades` | `int NOT NULL` | CHECK `> 0`; misma unidad de la línea/lote. |

Índices: `(IdEntrega)`, `(IdRecetaLinea, IdLote)`, `UNIQUE (IdEntrega, IdRecetaLinea, IdLote)` para no duplicar el mismo lote dentro de una confirmación. Cada detalle debe corresponder a la receta de su cabecera y el lote al medicamento de la línea: comprobarlos **bajo bloqueo transaccional**; FK simples no bastan para esa igualdad. Los saldos agregados se serializan por línea para evitar sobreentrega concurrente.

### 3.5 `AdministracionClinica` — acto separado y tres orígenes

| Columna | Tipo / NULL | Regla |
|---|---|---|
| `IdAdministracion`, `IdRecetaLinea`, `IdUsuarioResponsable` | `int IDENTITY NOT NULL`, dos `int NOT NULL` | PK, FK a línea y usuario. |
| `Origen` | `nvarchar(20) NOT NULL` | CHECK `InventarioDirecto`, `EntregaPrevia`, `Externo`. |
| `IdEntregaDetalle`, `IdLote` | `int NULL`, `int NULL` | FK opcionales según origen. |
| `CantidadUnidades` | `int NOT NULL` | CHECK `> 0`; no supera saldo de entrega si procede. |
| `DosisAplicada`, `UnidadDosis`, `Via` | `decimal(12,3) NOT NULL`, `nvarchar(30) NOT NULL`, `nvarchar(40) NOT NULL` | Dosis positiva y acto documentado. |
| `FechaAdministracionUtc` | `datetime2(3) NOT NULL` | Momento real del acto, nunca inferido de la entrega. |
| `ClaveOperacion`, `HashSolicitud` | `uniqueidentifier NOT NULL`, `binary(32) NOT NULL` | UNIQUE en clave. |
| `Observaciones` | `nvarchar(500) NULL` | Complemento clínico, sin claves codificadas. |

CHECK de origen: `InventarioDirecto` exige `IdLote` y `IdEntregaDetalle IS NULL`; `EntregaPrevia` exige `IdEntregaDetalle` y `IdLote IS NULL` (el lote se deriva de la entrega); `Externo` exige ambos NULL. Índices: `UQ_Administracion_ClaveOperacion`, `(IdRecetaLinea, FechaAdministracionUtc)`, `(IdEntregaDetalle)` filtrado para conteo. La entrega referida debe pertenecer a esa línea; validar transaccionalmente. Administración directa necesita salida y descuento atómicos. Entrega previa **no** crea salida. Externo **no** altera stock; documentar procedencia externa en `Observaciones` sin inventar un lote interno.

### 3.6 `SalidaClinica` — vínculo único con el libro de inventario

| Columna | Tipo / NULL | Regla |
|---|---|---|
| `IdSalidaClinica`, `IdMovimiento` | `int IDENTITY NOT NULL`, `int NOT NULL` | PK; FK a `MovimientoInventario`; UNIQUE `IdMovimiento`. |
| `IdEntregaDetalle`, `IdAdministracion` | `int NULL`, `int NULL` | FK a evento origen; CHECK XOR exactamente una no nula. |

Índices: UNIQUE filtrados separados para `IdEntregaDetalle` y `IdAdministracion` no nulos. El movimiento debe ser `Uso Interno`, con lote y cantidad idénticos al evento, en la misma transacción. Esta tabla es necesaria para **una unicidad global del movimiento** entre entrega y administración directa sin añadir columnas a `MovimientoInventario`. Una administración `EntregaPrevia` o `Externo` carece de fila aquí. No se atribuyen movimientos históricos por coincidencia temporal o textual.

### 3.7 `CorreccionClinica` — evento append-only de rectificación

| Columna | Tipo / NULL | Regla |
|---|---|---|
| `IdCorreccion` | `int IDENTITY NOT NULL` | PK. |
| `IdReceta`, `IdEntregaDetalle`, `IdAdministracion` | tres `int NULL` | FK; CHECK XOR: exactamente un evento objetivo. |
| `TipoCorreccion` | `nvarchar(30) NOT NULL` | CHECK de tipos aprobados (`SustitucionReceta`, `AnulacionEntrega`, `CorreccionAdministracion` son **candidatos**, no política vigente). |
| `Motivo`, `IdUsuarioResponsable`, `FechaUtc` | `nvarchar(500) NOT NULL`, `int NOT NULL`, `datetime2(3) NOT NULL` | Motivo no vacío; FK a usuario; sin borrado. |
| `CantidadAjusteUnidades` | `int NULL` | Magnitud positiva si la corrección es cuantitativa; semántica según tipo. |
| `IdMovimientoCompensatorio` | `int NULL` | FK UNIQUE a `MovimientoInventario` solo si hubo devolución física validada. |
| `ClaveOperacion`, `HashSolicitud` | `uniqueidentifier NOT NULL`, `binary(32) NOT NULL` | UNIQUE en clave. |

Índices: `UQ_Correccion_ClaveOperacion`, `UQ_Correccion_MovimientoCompensatorio` filtrado y búsqueda por cada FK objetivo. No se elimina ni edita el evento original. La anulación documental **no devuelve stock**. Un reintegro requiere evidencia de devolución/aptitud física, autorización y un movimiento compensatorio atómico con vínculo; qué `TipoMovimiento` y cómo se recalculan pendientes son decisiones farmacéuticas pendientes. Hasta aprobarlas, el endpoint de corrección deberá quedar deshabilitado y las recetas con movimientos confirmados permanecerán inmutables. La tabla es necesaria si se exige historial de correcciones controladas; sin ella el núcleo de prescripción/entrega/administración puede operar, pero **no** satisface rectificación auditable completa.

## 4. Idempotencia, atomicidad y concurrencia

Cada POST mutador propuesto recibe `Idempotency-Key` UUID generado **antes** de confirmar. El servicio calcula SHA-256 de una representación canónica del método, ruta/ámbito clínico, paciente/receta y payload normalizado; guarda clave + hash en la entidad cabecera dentro de la transacción. La clave es única por tipo de operación. Si llega la misma clave y mismo hash, tras autorizar nuevamente al solicitante, devuelve el recurso ya confirmado (respuesta recuperable tras pérdida de red); distinta carga devuelve `409`. El índice UNIQUE decide la carrera entre solicitudes simultáneas: ante conflicto 2601/2627, releer y comparar, no repetir el descuento. Si la transacción falló, no existe evento ni stock alterado y el mismo intento puede reintentarse. No registrar respuesta «en curso» como confirmada.

Para entrega: bloquear receta/líneas en orden estable, comprobar estado y saldos, bloquear lotes en orden de ID compatible con venta/consumo, verificar sucursal y vigencia, ejecutar decremento condicionado `CantidadDisponible >= solicitado`, insertar cabecera, detalles, movimientos `Uso Interno` y vínculos `SalidaClinica`, y confirmar juntos. Para directa, el mismo patrón con `AdministracionClinica` y un movimiento. Para administración desde entrega, bloquear `EntregaDetalle` y sus administraciones, calcular saldo y confirmar sin tocar inventario. `SERIALIZABLE` o una estrategia de bloqueos SQL Server equivalente + índices de acceso probados en SQL Server aislado; una lectura en memoria seguida de `SaveChanges` no garantiza saldos. Capturar deadlock/timeout para reintento de **la misma clave**, sin repetir la operación a ciegas.

Las ventas (`Venta Publica`) y consumos históricos compiten por `LoteMedicamento.CantidadDisponible`; probar sus órdenes de bloqueo conjuntamente. `LoteMedicamento.CantidadDisponible >= 0` ofrece defensa adicional, pero no reemplaza la condición atómica. Conciliar: cada nueva salida tiene exactamente un `SalidaClinica`; no hay vínculos duplicados; cantidades/lotes coinciden; total entregado+directo no supera lo prescrito; uso de entrega no supera cantidad entregada; saldos no negativos. Movimientos anteriores a la activación no se imputan a recetas nuevas.

## 5. Versiones, legados y decisiones aún necesarias

Una pauta confirmada es inmutable. Una sustitución crea `RecetaClinica` versión nueva y `IdRecetaAnterior` en una transacción; solo una vigente por tratamiento. **No trasladar automáticamente** entregas ni administraciones de la versión anterior: antes de permitir sustitución con actividad hay que aprobar una regla clínica para saldos ya dispensados, recuperación física y continuidad. Hasta entonces, sustituciones posteriores a una salida están bloqueadas. Tampoco se debe cambiar `Consulta.IdPaciente/IdMedico` cuando existen recetas gestionadas sin política de transferencia clínica.

Los tratamientos históricos conservan `IdLote/Cantidad` y el endpoint de consumo existente. Tratamientos con `RecetaClinica` usan esos campos en NULL para evitar dos fuentes de verdad, y un guard futuro rechazará `PUT` legado que les cambie lote/cantidad y `POST /consumos` legado sobre ellos; los demás tratamientos continúan funcionando. La clasificación «gestionado» se determina por existencia de FK `RecetaClinica.IdTratamiento`, no por fecha ni texto. Los movimientos históricos no se migran ni se vinculan retrospectivamente. Facturas, ventas, historial narrativo y 67 asignaciones RBAC actuales permanecen intactos.

**Aprobaciones imprescindibles antes de implementación:** excepción a inmutabilidad del esquema; verificación remota completa de claves/longitudes y objetos equivalentes; unidad de dispensación y conversión por medicamento; estados y posibilidad de prescribir/entregar tras cierre; reglas de sustitución y corrección/reintegro; responsable farmacéutico y clínico; permisos nuevos sin asignarlos automáticamente; retención/auditoría clínica. Véanse [`DECISION.md`](DECISION.md) y [`PLAN-IMPLEMENTACION.md`](PLAN-IMPLEMENTACION.md).
