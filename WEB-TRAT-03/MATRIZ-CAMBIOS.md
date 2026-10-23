# WEB-TRAT-03 — Matriz de compatibilidad y cambios propuestos

**Lectura:** «actual» procede de script/código y, donde se indica, de metadatos SSMS comunicados por el usuario en [`DB-AUDIT-AZURE-02/FINAL.md`](../DB-AUDIT-AZURE-02/FINAL.md). Codex no consultó Azure SQL. «Propuesto» no existe ni está autorizado para ejecución. La ausencia de un objeto con **otro nombre** no está certificada exhaustivamente.

| Necesidad | Contrato actual y evidencia | Alternativa A, esquema inmutable | Alternativa B propuesta | Cambio mínimo y condición |
|---|---|---|---|---|
| Consulta, paciente y médico | `Consulta.IdPaciente/IdMedico/IdSucursal` en entidad/script; `ConsultaService` valida ámbito. | Se derivan del tratamiento. | Derivar de Consulta vía Tratamiento y validar prescriptor autenticado. | No duplicar paciente/médico; bloquear mutación de relaciones para recetas gestionadas. |
| Diagnóstico específico | `Diagnostico.IdConsulta`; `Tratamiento` carece de `IdDiagnostico` según SSMS reportado. | No atribuible con certeza. | `RecetaClinica.IdDiagnostico` FK; validar misma consulta. | Tabla de cabecera y validación transaccional; FK compuesta a tablas actuales requeriría cambiar índices existentes y autorización distinta. |
| Varios medicamentos/pauta | Tratamiento acepta un solo `IdLote/Cantidad`; descripción/indicaciones hasta 300. | Varios tratamientos no constituyen una receta. | `RecetaLinea` N:1 con medicamento, dosis, vía, frecuencia, duración y cantidad. | Tabla nueva y política de unidades. `Medicamento.Presentacion` existe en script/EF, pero no es conversión de stock validada. |
| Prescripción sin salida | POST Tratamiento no descuenta. | Sí, para un tratamiento simple. | POST receta confirma cabecera+líneas sin movimiento. | Mantener separación. |
| Entrega parcial de farmacia | No hay entidad de entrega; `FacturaDetalle` es comercial (7 columnas y restricciones SSMS). | No hay saldo prescrito verificable. | `EntregaFarmacia` + `EntregaDetalle`, acumulados por línea. | Dos tablas; no reutilizar Factura/Venta. |
| Inventario por lote | `LoteMedicamento.CantidadDisponible`; `MovimientoInventario` con lote/usuario/sucursal/tipo/cantidad; `ConsumoClinicoService` descuenta atómicamente. | Salidas independientes, reenvío puede duplicar. | Reutilizar libro y stock; insertar `Uso Interno` junto con evento. | No alterar tabla de movimiento; venta/consumo compiten por stock. |
| Origen de cada salida | Movimiento no tiene FK de origen (SSMS reportado). | Irrecuperable inequívocamente. | `SalidaClinica.IdMovimiento UNIQUE` y XOR entrega/administración. | Tabla de vínculo global; no usar `Observaciones`. |
| Administración directa | No hay entidad estructurada de acto. | Consumo existente es salida, no historial de administración. | `AdministracionClinica` con origen directo y nueva salida atómica. | Tabla nueva y acto clínico verificable. |
| Administración desde entrega | No se sabe qué salida abasteció un acto. | Usar consumo otra vez descontaría dos veces. | Administración refiere a `EntregaDetalle` y no genera movimiento. | Limitar suma administrada al total de ese detalle. |
| Medicamento externo | No existe evento estructurado. | Texto libre no certifica origen. | Administración `Externo`, sin lote ni movimiento. | No reducir stock ni pendiente interno sin política. |
| Idempotencia | No se encontró clave persistente en estructuras examinadas; `IdMovimiento` es posterior al descuento. | No garantizada. | UUID + hash + UNIQUE por tipo en cabeceras/eventos. | Respuesta recuperable por GET; reintentos con misma clave. |
| Rectificación/versiones | PUT Tratamiento edita lote/cantidad; Bitacora tiene texto, no FK clínica. | No historial de correcciones estructurado. | Versiones inmutables y `CorreccionClinica` append-only. | Política de retorno físico y saldo pendiente antes de habilitar corrección. |
| Historial clínico | `HistorialMedico` vincula consulta/diagnóstico, pero `Descripcion` es narrativa; metadatos SSMS. | Tratamientos y movimientos separados. | Cadena Receta → Línea → Entrega/Administración → Salida/Corrección. | Consultas paginadas autorizadas, sin fabricar asociaciones históricas. |
| RBAC | `Permiso` tiene módulo y cuatro flags; 67 asignaciones actuales preservadas. | `Historial` y `ConsumoClinico` siguen con su alcance. | Módulos independientes propuestos por acto. | Requiere aprobación y concesión explícita; roles no bastan. |
| Auditoría de infraestructura | EF declara `IX_Bitacora_Tabla_Fecha`; SSMS del usuario confirmó que falta remotamente. | Sin cambio. | Sin dependencia de ese índice. | Divergencia documentada, fuera de alcance. |

## Objetos propuestos y justificación

| Objeto | ¿Por qué no basta el existente? | Garantía que aporta | Impacto autorizado hoy |
|---|---|---|---|
| `RecetaClinica` | Tratamiento no selecciona diagnóstico ni agrupa versión/actor. | Cabecera de prescripción con identidad y autor. | Ninguno: propuesta. |
| `RecetaLinea` | Un lote opcional en Tratamiento no modela N medicamentos y pauta. | Múltiples líneas y cantidad prescrita por medicamento. | Ninguno. |
| `EntregaFarmacia` | Factura es venta; movimiento no es entrega. | Evento de confirmación, usuario, fecha e idempotencia. | Ninguno. |
| `EntregaDetalle` | No hay línea/lote/cantidad por entrega. | Parcialidad, saldos y lote identificable. | Ninguno. |
| `AdministracionClinica` | Historial narrativo y consumo no representan el acto ni sus orígenes. | Administración directa, de entrega o externa. | Ninguno. |
| `SalidaClinica` | Movimiento no identifica evento originador. | FK 1:1 global sin alterar tabla vigente. | Ninguno. |
| `CorreccionClinica` | Bitacora no conserva rectificación clínica referencial ni compensación. | Evento correctivo rastreable; requiere política aprobada. | Ninguno. |

## Matriz de alcance y verificabilidad

| Afirmación | Grado | Fuente / pendiente |
|---|---|---|
| `Tratamiento.IdDiagnostico` no existe y movimiento no enlaza con receta/entrega/admin | Evidencia SSMS aportada por el usuario + código local | `DB-AUDIT-AZURE-02/FINAL.md`; Codex no hizo consulta remota. |
| `FacturaDetalle`, `HistorialMedico`, `Bitacora`, `Permiso` no sustituyen el modelo clínico | Columnas/FK/CHECK comunicados desde SSMS y semántica de servicios | La exportación verifica esos objetos, no todos los objetos con otro nombre. |
| Inventario de 27 tablas `dbo` | Reportado por usuario desde SSMS | La lista y el alcance del perfil de visibilidad se documentan en la auditoría; confirmar equivalentes ocultos antes de DDL. |
| `IX_Bitacora_Tabla_Fecha` ausente remotamente | SSMS aportado por usuario | No se propone crear. |
| Longitudes/precisión remotas de todas las tablas, otros índices no primarios y posibles equivalentes | Pendiente | Metadatos adicionales bajo identidad restringida, sin filas clínicas. |
| Atomicidad e idempotencia B | Diseño, no evidencia de ejecución | Probar en SQL Server aislado antes de prometerla en producción. |

**Conclusión:** la alternativa A conserva el tratamiento de una línea y una salida independiente. No satisface WEB-TRAT-01 completo. La B es necesaria para las garantías solicitadas, pero contradice la inmutabilidad vigente de Azure SQL y permanece no autorizada. No hay DDL, permisos ni código aplicados por este documento.
