# WEB-TRAT-06B-4 — Matriz de dependencias e integridad

**Fuentes:** `C:\Users\DESARROLLO\Desktop\script.sql` (SHA256 `59AEA7DFC361E81FE865478D24F2750C40F2489F028B5EB5AD40847FD1FF19CB`), `API-Clinica/Data/ClinicaDbContext.cs`, entidades de las siete tablas base, `DB-AUDIT-AZURE-02/FINAL.md`, `WEB-TRAT-06A/DDL-REVISADO.sql` y `WEB-TRAT-06B/ESQUEMA-AISLADO.sql`. El script es referencia documental; no fue ejecutado. Los metadatos Azure del informe fueron aportados por el usuario desde SSMS, no consultados por Codex en este corte.

## Tablas y orden propuesto

| Orden | Tabla sintética `dbo` | Razón de inclusión | PK / tipos relevantes | FK propuestas en el laboratorio |
|---:|---|---|---|---|
| 1 | `Sucursal` | Padre de consulta, empleado, clínica y movimiento. | `IdSucursal int IDENTITY` | Ninguna en el subconjunto. |
| 2 | `Paciente` | Padre de consulta. | `IdPaciente int IDENTITY` | Ninguna en el subconjunto. |
| 3 | `Empleado` | Médico responsable de consulta; empleado opcional de usuario. | `IdEmpleado int IDENTITY`; `IdSucursal int NOT NULL` | `IdSucursal → Sucursal`. Sus demás columnas y relaciones se omiten deliberadamente. |
| 4 | `Clinica` | `Consulta.IdClinica` nullable. | `IdClinica int IDENTITY`; `IdSucursal int NOT NULL` | `IdSucursal → Sucursal`. |
| 5–7 | `Rol`, `Categoria`, `Marca` | Padres de usuario y medicamento. | Cada ID `int IDENTITY` | Ninguna en el subconjunto. |
| 8 | `Usuario` | Actor de receta, entrega, administración, corrección y movimiento. | `IdUsuario int IDENTITY`; `IdRol int NOT NULL`; `IdEmpleado int NULL` | `IdRol → Rol`; `IdEmpleado → Empleado`. |
| 9 | `Consulta` | Padre de diagnóstico y tratamiento. | `IdConsulta int IDENTITY`; `IdPaciente/IdMedico/IdSucursal int NOT NULL`; `IdClinica int NULL` | `Paciente`, `Empleado`, `Sucursal`, `Clinica`. |
| 10 | `Diagnostico` | Referencia de receta. | `IdDiagnostico int IDENTITY`; `IdConsulta int NOT NULL` | `IdConsulta → Consulta`. |
| 11 | `Medicamento` | Referencia de línea de receta y lote. | `IdMedicamento int IDENTITY`; `IdCategoria/IdMarca int NOT NULL` | `Categoria`, `Marca`. |
| 12 | `LoteMedicamento` | Entrega/administración directa y stock. | `IdLote int IDENTITY`; `IdMedicamento int NOT NULL`; `CantidadDisponible int NOT NULL` | `IdMedicamento → Medicamento`. |
| 13 | `Tratamiento` | Referencia de receta; soporte legado. | `IdTratamiento int IDENTITY`; `IdConsulta int NOT NULL`; `IdLote int NULL`; `Cantidad smallint NULL` | `Consulta`, `LoteMedicamento`. **No hay `IdDiagnostico`**. |
| 14 | `MovimientoInventario` | Referencia de `SalidaClinica` y conciliación. | `IdMovimiento int IDENTITY`; `IdLote/IdUsuario/IdSucursal int NOT NULL` | `LoteMedicamento`, `Usuario`, `Sucursal`. |

Son **siete tablas base y siete padres auxiliares**. Los padres son stubs de PK para pruebas sintéticas; no son reproducción de la API ni datos clínicos. Esta inclusión responde a FK reales del script y EF; no introduce una octava tabla al modelo clínico de siete tablas nuevas. Las siete nuevas (`RecetaClinica`, `RecetaLinea`, `EntregaFarmacia`, `EntregaDetalle`, `AdministracionClinica`, `SalidaClinica`, `CorreccionClinica`) permanecen únicamente en `WEB-TRAT-06A/DDL-REVISADO.sql` y la copia protegida `DDL-EJECUCION-AISLADA.sql`.

## Cotejo de tipos, nulabilidad y restricciones

| Campo / regla | Script y EF | Propuesta sintética | Límite |
|---|---|---|---|
| IDs PK/FK del conjunto | `int`; PK `IDENTITY(1,1)`, FK del mismo tipo | `int`, PK `IDENTITY(1,1)`, FK `int` | Compatibilidad de tipo, sin usar IDs reales. |
| `Consulta.FechaConsulta`, textos, signos | `datetime2(7)`, `nvarchar(300)` nullable; `float`/`int` nullable | Mismos tipos y nulabilidad | No replica todos los índices o checks de producción. |
| `Consulta.EstadoConsulta`, `TemperaturaC`, `FrecuenciaCardiaca` | EF y evidencia Azure posterior: `nvarchar(30) NULL`, `decimal(4,1) NULL`, `smallint NULL`; no figuran en el `script.sql` del 12/10 | Incluidos para la versión documentada | Revalidar metadatos reales antes de cualquier comparación formal con producción. |
| `Diagnostico.Descripcion/FechaRegistro` | `nvarchar(300) NOT NULL`, `datetime2(7) NOT NULL`, default UTC | Iguales | No existe `Diagnostico.IdMedico` persistido; EF lo ignora. |
| `Tratamiento` | `IdLote int NULL`, `Cantidad smallint NULL`, descripción/indicaciones `nvarchar(300)`, fechas `date` | Iguales | El tratamiento histórico no queda vinculado a diagnóstico por FK propia. |
| `Usuario.Username/PasswordHash` | `nvarchar(50) NOT NULL` UNIQUE; `nvarchar(max) NOT NULL` | Iguales | Solo hashes ficticios en pruebas futuras, nunca credenciales reales. |
| `Medicamento` | `Codigo nvarchar(50)` UNIQUE, `PrecioVenta decimal(18,2)` positivo, `Presentacion nvarchar(100) NULL` | Iguales | La presentación textual **no** es equivalencia de dosis. |
| `LoteMedicamento` | `CantidadDisponible int NOT NULL` con CHECK `>= 0`; fechas `date` | Iguales | Igualdad medicamento de lote/línea requiere validación transaccional. |
| `MovimientoInventario` | `TipoMovimiento nvarchar(30)` y CHECK de cinco valores; `Cantidad int NOT NULL`; fecha UTC default | Iguales para esas columnas | No tiene vínculo persistente con evento clínico sin `SalidaClinica`. |

Todas las FK de la propuesta usan `NO ACTION` implícito. La propuesta excluye deliberadamente la mayor parte de las columnas de las siete tablas auxiliares y las relaciones hacia otros módulos; por ello **no** sirve para ejecutar la API completa ni equivale a un clon de `db_Clinica`. En el script sintético no se fija un `CHECK (Cantidad > 0)` en `MovimientoInventario`: la evidencia documental confirma el tipo y la regla de `TipoMovimiento`, pero la validación de cantidad debe cotejarse antes de atribuirla al contrato real.

## Dependencias de las siete tablas propuestas

| Nueva tabla | Padres requeridos | Garantía declarativa futura | Pendiente fuera del DDL |
|---|---|---|---|
| `RecetaClinica` | Tratamiento, Diagnostico, Usuario, RecetaClinica | FK individuales, versión, clave idempotente, una vigente por tratamiento | Misma consulta de tratamiento y diagnóstico; estados aprobados. |
| `RecetaLinea` | RecetaClinica, Medicamento, Usuario validador | FK, orden y cantidad positivos | Equivalencia farmacéutica y al menos una línea. |
| `EntregaFarmacia` | RecetaClinica, Usuario | FK e idempotencia | Saldo y rol farmacéutico. |
| `EntregaDetalle` | EntregaFarmacia, RecetaLinea, LoteMedicamento | FK compuestas para misma receta | Mismo medicamento línea/lote y stock. |
| `AdministracionClinica` | RecetaLinea, Usuario, EntregaDetalle, LoteMedicamento | CHECK de origen excluyente, FK e idempotencia | Suma administrada ≤ entregada; dosis clínica. |
| `SalidaClinica` | MovimientoInventario, EntregaDetalle, AdministracionClinica | Origen exclusivo y unicidad de movimiento/evento | Correspondencia de lote, cantidad, usuario y sucursal en un COMMIT. |
| `CorreccionClinica` | RecetaClinica, EntregaDetalle, AdministracionClinica, Usuario, MovimientoInventario | Un objetivo e idempotencia | Política de reintegro/devolución aún sin aprobar; operaciones bloqueadas. |

Ninguna de estas garantías se ha probado en motor. Las igualdades cruzadas no pueden hacerse cumplir enteramente con las FK del borrador sin cambiar estructuras existentes o controlar todos los escritores; ver `WEB-TRAT-06A/INTEGRIDAD-RELACIONAL.md`. SQL Server Express local y la base vacía se verificaron en 06B-3, pero **no se consultó SQL en 06B-4**.
