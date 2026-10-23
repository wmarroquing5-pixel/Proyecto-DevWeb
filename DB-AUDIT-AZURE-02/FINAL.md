# DB-AUDIT-AZURE-02 — Consolidación de resultados

**Fecha:** 22/10/2026 (America/Guatemala). **Estado:** cerrado documentalmente el alcance de las cinco tablas y los 28 metadatos recibidos de SSMS; límites de la evidencia identificados abajo. **WEB-TRAT-01 permanece bloqueado.**

## 1. Procedencia de la evidencia

| Origen | Evidencia | Alcance |
|---|---|---|
| **SSMS, comunicada por el usuario** | Identidad, permisos, inventario de 27 tablas completado, 36 columnas y los 28 registros de FK/índices/CHECK/DEFAULT de cinco tablas descritos abajo. | Codex no ejecutó consultas SQL; leyó y contrastó el CSV exportado por el usuario. El inventario y los metadatos se registran como evidencia aportada, no como inspección remota propia. |
| **Codex, archivos locales** | `C:\Users\DESARROLLO\Desktop\script.sql` (SHA256 `59AEA7DFC361E81FE865478D24F2750C40F2489F028B5EB5AD40847FD1FF19CB`), entidades, DTO y `API-Clinica/Data/ClinicaDbContext.cs`. | Describe script y código; no certifica por sí solo el esquema desplegado. |
| **Codex, Azure SQL** | Ninguna conexión ni consulta remota en esta consolidación. | No atribuir a Codex la autenticación o las consultas hechas en SSMS. |

El informe anterior documentó que **en ese momento** Codex no tenía perfil de auditoría independiente. La identidad configurada y verificada después por el usuario permite su auditoría en SSMS; no implica que Codex disponga ahora de un perfil utilizable. No se documentan contraseñas ni cadenas de conexión.

## 2. Identidad y catálogo reportados desde SSMS

- Identidad autenticada: `aud_empresa` mediante autenticación SQL Server; servidor `srwemg.database.windows.net`; base `db_Clinica`. No se recibió evidencia del cifrado de la sesión.
- Permisos efectivos **reportados**: `CONNECT`, `VIEW DEFINITION`, `VIEW PERFORMANCE DEFINITION` y `VIEW SECURITY DEFINITION`. Según las comprobaciones comunicadas, no pertenece a los roles administrativos evaluados ni tiene lectura de filas o modificación sobre las **nueve tablas clínicas comprobadas**. Esto no demuestra ausencia universal de permisos en todos los objetos o bases; faltan la lista de esas nueve tablas y la salida detallada.
- **Inventario de 27 tablas `dbo` completado en SSMS según el usuario**, incluida `sysdiagrams`. Esta tarea ya no tiene pendiente obtener el inventario. Codex no repitió su lectura en Azure ni realizó un cotejo nominal independiente. El script local declara 26 tablas `dbo` y no declara `sysdiagrams`; el conteo es compatible con una tabla adicional, sin demostrar por sí solo equivalencia nombre a nombre. `sysdiagrams` no es almacenamiento de recetas o eventos clínicos.
- El usuario informa que inspeccionó columnas, FK, índices y restricciones de `Diagnostico`, `Tratamiento`, `Medicamento`, `LoteMedicamento` y `MovimientoInventario`. Para `Factura`, `FacturaDetalle`, `HistorialMedico`, `Bitacora` y `Permiso` aportó antes las columnas, tipos base y nulabilidad, y ahora el CSV de FK, índices, CHECK y DEFAULT descrito en §4. No se han aportado longitudes/precisión/escala remotas de esas columnas.
- `Tratamiento` tiene `IdConsulta`, `IdLote` y `Cantidad`, pero no `IdDiagnostico`. `MovimientoInventario` no tiene vínculo persistente con receta, tratamiento, entrega o administración. No se identificó clave de idempotencia en las estructuras examinadas.
- No se encontraron tablas con los **nombres propuestos** para receta multilínea, entrega, administración o salida clínica. Esa búsqueda nominal no descarta una estructura equivalente con otro nombre; la conclusión requiere comprobar también sus columnas y relaciones, no repetir el conteo de tablas ya completado.

**Referencia documental de las 26 tablas del script local:** `AsignacionHabitacion`, `Bitacora`, `Categoria`, `Clinica`, `Consulta`, `ContactoEmergencia`, `Diagnostico`, `Empleado`, `Especialidad`, `Examen`, `Factura`, `FacturaDetalle`, `Habitacion`, `HistorialMedico`, `LoteMedicamento`, `Marca`, `Medicamento`, `MovimientoInventario`, `Paciente`, `Permiso`, `Rol`, `Servicio`, `Sucursal`, `Tratamiento`, `Turno` y `Usuario`. Junto con la `sysdiagrams` reportada, son 27 nombres de referencia; los 26 del script **no se presentan como transcripción de la salida SSMS**.

## 3. Columnas verificadas desde SSMS según el usuario

La salida aportada usa `is_nullable`: **0 = NOT NULL**, **1 = NULL**. Contiene nombre, tipo base y nulabilidad, pero no longitud, precisión, escala, DEFAULT, identidad, FK, índices o CHECK.

| Tabla | Columnas reportadas (tipo; nullable 1/0) | Coincidencia con las columnas del script local |
|---|---|---|
| `Factura` | `IdFactura int 0`; `IdUsuario int 0`; `IdSucursal int 0`; `FechaFactura datetime2 0`; `Total decimal 0`; `IdPaciente int 1`; `Nit nvarchar 1`; `NombreFacturacion nvarchar 1`; `TipoFactura nvarchar 0`. | Coinciden los nueve nombres, tipos base y nulabilidad. |
| `FacturaDetalle` | `IdDetalle int 0`; `IdFactura int 0`; `IdLote int 1`; `Cantidad int 0`; `PrecioUnitario decimal 0`; `Subtotal decimal 0`; `IdServicio int 1`. | Coinciden los siete nombres, tipos base y nulabilidad. |
| `HistorialMedico` | `IdHistorial int 0`; `IdConsulta int 1`; `FechaHistorial datetime2 0`; `Descripcion nvarchar 0`; `IdDiagnostico int 1`. | Coinciden los cinco nombres, tipos base y nulabilidad. |
| `Bitacora` | `IdBitacora int 0`; `IdUsuario int 1`; `TablaAfectada nvarchar 0`; `Accion nvarchar 0`; `RegistroId nvarchar 0`; `ValoresAnteriores nvarchar 1`; `ValoresNuevos nvarchar 1`; `Fecha datetime2 0`. | Coinciden los ocho nombres, tipos base y nulabilidad. |
| `Permiso` | `IdPermiso int 0`; `IdRol int 0`; `Modulo nvarchar 0`; `PuedeConsultar bit 0`; `PuedeCrear bit 0`; `PuedeModificar bit 0`; `PuedeEliminar bit 0`. | Coinciden los siete nombres, tipos base y nulabilidad. |

Esta coincidencia **no verifica remotamente** las longitudes ni restricciones. Las cinco tablas tampoco tienen en las columnas reportadas una FK a receta, entrega, administración o movimiento, ni una columna de clave de operación; no se infiere de ello el contenido de otras tablas no transcritas.

## 4. Metadatos remotos aportados y comparación documental

**Fuente:** `C:\Users\DESARROLLO\Desktop\DB-AUDIT-AZURE-02-METADATOS.csv`, SHA256 `D92E3893F451C4132EBB7E0D14C368A476C4C7790C03300A2534B118D61D738F`. Es un CSV sin encabezado, delimitado por punto y coma; Codex verificó que contiene **28 registros**, sin nombres de objeto duplicados dentro de cada clase: **10 FOREIGN KEY, 5 INDEX, 6 CHECK y 7 DEFAULT**. Fue exportado desde SSMS por el usuario mediante `aud_empresa`; Codex no consultó Azure SQL.

### 4.1 Diez claves foráneas

| Tabla | FK y relación reportada | Script / EF Core |
|---|---|---|
| `Bitacora` | `FK_Bitacora_Usuario`: `IdUsuario → dbo.Usuario.IdUsuario` | Coincide; `IdUsuario` nullable. |
| `Factura` | `FK_Factura_Paciente`: `IdPaciente → dbo.Paciente.IdPaciente`; `FK_Venta_Sucursal`: `IdSucursal → dbo.Sucursal.IdSucursal`; `FK_Venta_Usuario`: `IdUsuario → dbo.Usuario.IdUsuario` | Coinciden las tres; solo `IdPaciente` es nullable. |
| `FacturaDetalle` | `FK_Detalle_Lote`: `IdLote → dbo.LoteMedicamento.IdLote`; `FK_Detalle_Servicio`: `IdServicio → dbo.Servicio.IdServicio`; `FK_Detalle_Venta`: `IdFactura → dbo.Factura.IdFactura` | Coinciden las tres; lote y servicio son nullable por separado. |
| `HistorialMedico` | `FK_Evolucion_Consulta`: `IdConsulta → dbo.Consulta.IdConsulta`; `FK_HistorialMedico_Diagnostico`: `IdDiagnostico → dbo.Diagnostico.IdDiagnostico` | Coinciden ambas; columnas nullable. |
| `Permiso` | `FK_Permiso_Rol`: `IdRol → dbo.Rol.IdRol` | Coincide; columna no nullable. |

El CSV muestra las diez FK sin señal de deshabilitación o falta de confianza en los campos exportados, pero no se conoce la consulta exacta ni todos los atributos del catálogo; la interpretación se limita a los nombres y referencias declarados. Ninguna de estas FK enlaza factura, historial o bitácora con una receta o evento de administración.

### 4.2 Cinco índices

| Tabla | Nombre reportado / columna | Comparación |
|---|---|---|
| `Bitacora` | `PK__Bitacora__ED3A1B13DD2FA98D` / `IdBitacora` | PK única, como script/EF. |
| `Factura` | `PK__Factura__50E7BAF156B761BC` / `IdFactura` | PK única, como script/EF. |
| `FacturaDetalle` | `PK__FacturaD__E43646A5FBB3C5C1` / `IdDetalle` | PK única, como script/EF. |
| `HistorialMedico` | `PK__Historia__9CC7DBB45A11AF36` / `IdHistorial` | PK única, como script/EF. |
| `Permiso` | `PK__Permiso__0D626EC83E576E5A` / `IdPermiso` | PK única, como script/EF. |

Los cinco registros INDEX del CSV indican `Unico=1`, `Primaria=1`, sin filtro. Los sufijos de nombres generados no son un contrato estable; se comparó la columna y condición de PK. **Verificación adicional comunicada por el usuario desde SSMS mediante `aud_empresa`: `dbo.Bitacora` tiene únicamente el índice CLUSTERED de la PK `IdBitacora`; `IX_Bitacora_Tabla_Fecha` no existe en el esquema real consultado.** Codex no ejecutó esa consulta ni recibió una nueva exportación para esta comprobación. `ClinicaDbContext` sí declara el índice sobre `TablaAfectada, Fecha`, mientras el script local no contiene un `CREATE INDEX` correspondiente. La divergencia EF–Azure queda confirmada por la evidencia SSMS aportada; **no crear ni migrar** el índice en esta fase. La verificación adicional se limita a `dbo.Bitacora` y no certifica la totalidad de índices no primarios de las demás tablas.

### 4.3 Seis restricciones CHECK

| Tabla | Restricción y definición reportada | Script / EF Core |
|---|---|---|
| `Factura` | `CHK_Factura_Tipo`: `TipoFactura` es `Estancia Medica` o `Venta Publica`; `CHK_Venta_Total`: `Total > 0`. | Ambas coinciden semánticamente. |
| `FacturaDetalle` | `CHK_Detalle_Producto_O_Servicio`: exactamente uno de `IdLote` o `IdServicio`; `CHK_VentaDetalle_Cantidad`: `Cantidad > 0`; `CHK_VentaDetalle_Precio`: `PrecioUnitario > 0`; `CHK_VentaDetalle_Subtotal`: `Subtotal > 0`. | Las cuatro coinciden semánticamente. |

El CSV marca `0/0` en los dos indicadores exportados para las seis CHECK; la consulta generadora no se adjuntó, por lo que no se deducen propiedades adicionales más allá de la definición recibida.

### 4.4 Siete valores DEFAULT

| Tabla | Columna / nombre de restricción reportado / valor | Script / EF Core |
|---|---|---|
| `Bitacora` | `Fecha` / `DF__Bitacora__Fecha__2739D489` / `sysutcdatetime()` | Coincide. |
| `Factura` | `FechaFactura` / `DF__Factura__FechaFa__2CF2ADDF` / `sysutcdatetime()`; `TipoFactura` / `DF__Factura__TipoFac__2DE6D218` / `Venta Publica` | Coinciden. |
| `Permiso` | `PuedeConsultar` / `DF__Permiso__PuedeCo__3493CFA7` / `0`; `PuedeCrear` / `DF__Permiso__PuedeCr__3587F3E0` / `0`; `PuedeEliminar` / `DF__Permiso__PuedeEl__37703C52` / `0`; `PuedeModificar` / `DF__Permiso__PuedeMo__367C1819` / `0` | Coinciden. |

Los nombres `DF__...` generados por SQL Server son evidencia de esta exportación, no nombres que la API deba fijar. `Examen.IdDiagnostico` vincula examen con diagnóstico, no tratamiento con diagnóstico. `Tratamiento` y `MovimientoInventario` conservan la corroboración parcial reportada en §2.

Los campos narrativos, `Bitacora`, `Factura` y los objetos R2 no sustituyen una relación clínica comprobable ni una clave única transaccional. No se ha demostrado un índice autorizado y atómico en R2 para recetas, entregas, administraciones y movimientos; esto es análisis de arquitectura, no inspección remota de R2.

## 5. Matriz de compatibilidad

| Requisito | A: estructuras actuales | B: persistencia ampliada | Evidencia |
|---|---|---|---|
| Tratamiento asociado a consulta y un lote | Parcial: sí | Sí | Script/EF y columnas reportadas de `Tratamiento`. |
| Atribución a diagnóstico específico | No en `Tratamiento` | FK y validación de misma consulta | `IdDiagnostico` ausente en `Tratamiento` según SSMS; `HistorialMedico.IdDiagnostico` no lo reemplaza. |
| Receta con varias líneas | No garantizada | Cabecera y líneas persistentes | `FacturaDetalle` tiene líneas comerciales; sus siete columnas, tres FK y cuatro CHECK de SSMS no la vinculan a receta. Un equivalente con otro nombre requiere examinar sus columnas y relaciones. |
| Entregas parciales y saldo por línea | No | Eventos y acumulados | Las FK y CHECK de `Factura`/`FacturaDetalle` recibidas vinculan paciente, usuario, sucursal, factura, lote o servicio; no receta/tratamiento ni saldo clínico. |
| Administración clínica separada | No | Evento con origen explícito | Las dos FK de `HistorialMedico` son a consulta/diagnóstico y su contenido es narrativo; el CSV no aporta evento de administración en estas cinco tablas. |
| Cada salida ligada a su operación | No en movimiento examinado | Vínculo unívoco movimiento–evento | Ausencia reportada en SSMS para `MovimientoInventario`. |
| Reintentos sin doble descuento | No demostrable | Clave única y transacción | Ninguno de los cinco índices exportados ni los siete DEFAULT aporta clave de operación; el consumo actual recibe cantidad sin clave de solicitud. La revisión adicional de índices de `Bitacora` tampoco revela una clave de idempotencia. |
| Sin cambio de esquema | Sí, con alcance reducido | No con el diseño propuesto | Regla vigente de base inmutable. |

**Conclusión:** A conserva tratamiento simple y consumos independientes, pero no acredita WEB-TRAT-01 completo. B, o **un mecanismo persistente formalmente aprobado con garantías equivalentes**, sigue siendo necesaria para receta multilínea, entregas y administraciones separadas, trazabilidad e idempotencia. B continúa **incompatible con la prohibición vigente de DDL**; este análisis no autoriza ejecutarla.

## 6. Recomendación y pendientes

1. Mantener **WEB-TRAT-01 bloqueado**. No presentar facturas, evoluciones narrativas o consumos independientes como flujo completo de receta, entrega y administración.
2. El inventario de 27 tablas, las **36 columnas** de §3, los **28 metadatos** de §4 y la comprobación adicional de índices de `dbo.Bitacora` están incorporados como evidencia SSMS aportada. La ausencia física de `IX_Bitacora_Tabla_Fecha` ya no está pendiente. Siguen pendientes la longitud/precisión/escala remota de columnas, el alcance de índices no primarios de las otras cuatro tablas, las columnas/relaciones de posibles estructuras equivalentes con otro nombre y un cotejo remoto independiente si se exigiera; no se necesitan filas clínicas.
3. Para implementar el flujo completo, solicitar primero una **decisión expresa del dueño de datos sobre la regla de inmutabilidad del esquema**, junto con aprobación clínica, farmacéutica, de seguridad/RBAC y DBA del diseño en `WEB-TRAT-02/DISENO.md`. Mientras siga vigente, cualquier trabajo futuro debe limitarse a garantías demostrables con A.
4. Antes de programar B, validar unidad de dispensación, vínculos con diagnóstico, saldos, origen de administración, concurrencia, idempotencia, reversión y conciliación en un entorno aislado, nunca mediante escrituras productivas.

**Codex en esta fase:** solo lectura local y documentación; conexiones Azure SQL, lectura de filas clínicas, escrituras SQL, migraciones, cambios de permisos y despliegues: **0**.
