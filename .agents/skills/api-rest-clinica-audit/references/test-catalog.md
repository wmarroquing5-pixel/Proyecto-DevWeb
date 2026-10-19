# Catálogo mínimo de pruebas

Este catálogo es obligatorio. Ajusta rutas y nombres al contrato real de la API; no inventes endpoints.

| ID | Requisito | Prueba | Resultado esperado |
|---|---|---|---|
| ARC-001 | RQ-ARCH-01 | Verificar TargetFramework | Proyecto API usa `net10.0` |
| ARC-002 | RQ-ARCH-02 | Verificar proveedor EF Core | Usa EF Core para persistencia |
| ARC-003 | RQ-ARCH-03 | Verificar configuración Azure SQL | Provider SQL Server y conexión configurable |
| ARC-004 | RQ-ARCH-04/05 | Revisar separación frontend/API/BD | No existe acceso directo del frontend a SQL |
| ARC-005 | RQ-ARCH-06 | Verificar repositorio Git | Repositorio Git válido; seguimiento documentable |
| ARC-006 | RQ-ARCH-07 | Verificar URL Azure | API pública responde por HTTPS |
| ARC-007 | RQ-ARCH-08 | Verificar existencia Dockerfile | Dockerfile presente y aplicable a API |
| ARC-008 | RQ-ARCH-08 | `docker build` | Imagen construye sin error |
| ARC-009 | RQ-ARCH-08 | Ejecutar imagen | API responde desde contenedor |
| ARC-010 | Calidad | `dotnet restore/build Release` | Compilación exitosa |
| DB-001 | RQ-ARCH-02/03 | Conectividad no destructiva | API conecta a Azure SQL mediante EF Core |
| DB-002 | Calidad | Error de BD controlado | No filtra secretos; respuesta controlada |
| AUTH-001 | RQ-AUTH-01 | Login válido | Credenciales correctas son validadas contra BD |
| AUTH-002 | RQ-AUTH-01 | Login usuario inexistente | Rechazo controlado, sin revelar datos |
| AUTH-003 | RQ-AUTH-01 | Login contraseña incorrecta | Rechazo controlado |
| AUTH-004 | RQ-AUTH-02 | JWT en login válido | Devuelve token firmado |
| AUTH-005 | RQ-AUTH-03 | Recurso protegido sin token | 401 |
| AUTH-006 | RQ-AUTH-03 | Token alterado | 401 |
| AUTH-007 | RQ-AUTH-04 | Token expirado | 401 |
| AUTH-008 | RQ-AUTH-04 | Token vigente | Recurso protegido puede continuar a autorización |
| AUTH-009 | Seguridad | JWT no contiene secretos innecesarios | Claims mínimos y no sensibles |
| AUTH-010 | Seguridad | Contraseña almacenada | No se almacena en texto plano |
| PERM-001 | RQ-PERM-01 | Crear usuario autorizado | Usuario creado correctamente |
| PERM-002 | RQ-PERM-01 | Crear rol autorizado | Rol creado correctamente |
| PERM-003 | RQ-PERM-02/03 | Asignar Consultar | Permiso persistido y efectivo |
| PERM-004 | RQ-PERM-02/03 | Asignar Crear | Permiso persistido y efectivo |
| PERM-005 | RQ-PERM-02/03 | Asignar Modificar | Permiso persistido y efectivo |
| PERM-006 | RQ-PERM-02/03 | Asignar Eliminar | Permiso persistido y efectivo |
| PERM-007 | RQ-PERM-04 | Reiniciar API tras asignación | Permisos permanecen por estar en BD |
| PERM-008 | RQ-PERM-05 | Revocar permiso sin recompilar | Siguiente solicitud queda denegada |
| PERM-009 | RQ-PERM-05 | Otorgar permiso sin recompilar | Siguiente solicitud queda autorizada |
| PERM-010 | RQ-PERM-06 | Buscar autorización hardcodeada | No depende de condiciones específicas por usuario |
| PERM-011 | RQ-AUTH-05 | Usuario sin permiso | 403 antes de modificar datos |
| PERM-012 | RQ-PERM-07 | Endpoint/claims para menú dinámico | Frontend puede obtener permisos efectivos |
| PAT-001 | RQ-PAT-01 | Crear paciente válido | 201/éxito y persistencia |
| PAT-002 | RQ-PAT-01 | Consultar paciente | Devuelve registro correcto |
| PAT-003 | RQ-PAT-01 | Actualizar paciente | Persistencia correcta |
| PAT-004 | RQ-PAT-01 | Eliminar paciente permitido | Eliminación/estrategia definida funciona |
| PAT-005 | RQ-PAT-02 | Datos inválidos | 400, sin persistir |
| PAT-006 | RQ-PAT-03 | Consultas vinculadas | Historial corresponde al paciente |
| PAT-007 | RQ-PAT-03 | Tratamientos vinculados | Relación correcta |
| INV-001 | RQ-INV-01 | CRUD medicamento/producto | Operaciones funcionan según permisos |
| INV-002 | RQ-INV-02 | Crear lote | Persiste lote asociado |
| INV-003 | RQ-INV-03 | Campos mínimos lote | Todos los campos requeridos disponibles |
| INV-004 | RQ-INV-03 | Fecha vencimiento inválida | Rechazo cuando corresponda |
| INV-005 | RQ-INV-04 | Entrada inventario | Cantidad aumenta correctamente |
| INV-006 | RQ-INV-04 | Salida uso clínico | Cantidad disminuye correctamente |
| INV-007 | RQ-BR-02 | Uso clínico de lote vencido | Operación rechazada |
| EMP-001 | RQ-EMP-01 | Crear empleado | Persistencia correcta |
| EMP-002 | RQ-EMP-01 | Consultar/actualizar/eliminar | CRUD conforme a permisos |
| EMP-003 | RQ-EMP-02 | Tipos de personal | Puede representar doctor/enfermería/administrativo |
| EMP-004 | RQ-EMP-03 | Especialidad | Relación persistida correctamente |
| EMP-005 | RQ-EMP-03 | Rol de sistema | Asignación consistente con autorización |
| ROOM-001 | RQ-ROOM-01/02 | Crear habitación libre | Estado válido |
| ROOM-002 | RQ-ROOM-02 | Cambiar a limpieza | Estado persistido |
| ROOM-003 | RQ-ROOM-05 | Asignar paciente a libre | Éxito y habitación ocupada |
| ROOM-004 | RQ-BR-04 | Asignar segundo paciente a ocupada | Rechazo, sin doble asignación |
| ROOM-005 | RQ-ROOM-06/RQ-BR-05 | Ingreso | Fecha de ingreso registrada |
| ROOM-006 | RQ-ROOM-06/RQ-BR-05 | Egreso | Fecha de egreso registrada y estado coherente |
| ROOM-007 | Concurrencia | Dos asignaciones simultáneas | Solo una puede confirmar |
| SIG-001 | RQ-ROOM-03 | Conexión al Hub | Cliente conecta correctamente |
| SIG-002 | RQ-ROOM-03 | Cambio de habitación | Evento SignalR emitido |
| SIG-003 | RQ-ROOM-03 | Dos clientes conectados | Ambos observan cambio sin recarga |
| SIG-004 | RQ-ROOM-03 | Estado final | Evento y BD terminan consistentes |
| CLIN-001 | RQ-CLIN-01 | Registrar consulta | Vinculada a paciente y profesional |
| CLIN-002 | RQ-CLIN-02/05 | Registrar diagnóstico autorizado | Éxito y autor correcto |
| CLIN-003 | RQ-BR-06 | Registrar diagnóstico sin permiso | 403 y cero cambios |
| CLIN-004 | RQ-CLIN-03 | Registrar tratamiento | Persistencia y vínculo correctos |
| CLIN-005 | RQ-CLIN-04 | Registrar examen | Guarda fecha y resultado |
| CLIN-006 | RQ-CLIN-06 | Registrar evolución | Seguimiento vinculado y ordenable temporalmente |
| SALE-001 | RQ-SALE-01/02 | Venta válida | Cabecera y detalle persistidos |
| SALE-002 | RQ-SALE-02 | Usuario de venta | Usuario autenticado queda registrado |
| SALE-003 | RQ-SALE-02 | Totales | Cantidad x precio y total consistentes |
| SALE-004 | RQ-SALE-03/RQ-BR-03 | Stock antes/después | Descuento exacto del lote |
| SALE-005 | RQ-SALE-04/RQ-BR-01 | Venta sin stock | Rechazo y stock no negativo |
| SALE-006 | RQ-BR-02 | Venta lote vencido | Rechazo y sin cambios |
| SALE-007 | Integridad | Fallo al guardar detalle | Transacción evita venta parcial |
| SALE-008 | Concurrencia | Dos ventas compiten por stock final | No hay sobreventa/stock negativo |
| MULTI-001 | RQ-MULTI-01 | Sucursales disponibles | Modelo/API soporta múltiples clínicas |
| MULTI-002 | RQ-MULTI-02 | Datos por sucursal | Asociación/aislamiento conforme al modelo |
| MOB-001 | RQ-MOB-01 | API pública reutilizable | Móvil puede consumir la misma API |
| MOB-002 | RQ-MOB-02 | Lista de farmacia | Incluye nombre, precio, marca, descripción, existencia, imagen |
| MOB-003 | RQ-MOB-03 | Detalle producto | Retorna detalle del producto solicitado |
| MOB-004 | RQ-MOB-04 | Filtro por nombre | Resultado filtrado correcto |
| MOB-005 | RQ-MOB-04 | Filtro por marca | Resultado filtrado correcto |
| MOB-006 | RQ-MOB-04 | Filtro por categoría | Resultado filtrado correcto |
| SEC-001 | RQ-BR-07 | CRUD protegido sin JWT | 401 y sin cambios |
| SEC-002 | RQ-BR-07 | JWT válido sin permiso | 403 y sin cambios |
| SEC-003 | Seguridad | Mass assignment | No permite modificar campos sensibles no autorizados |
| SEC-004 | Seguridad | Inyección/inputs maliciosos básicos | EF parametriza y API responde controladamente |
| SEC-005 | Seguridad | Error inesperado | No expone stack trace en producción |
| SEC-006 | Seguridad | Logging | No registra password/JWT completo/secretos |
| API-001 | Calidad | OpenAPI/Swagger | Contrato accesible en entorno permitido |
| API-002 | Calidad | 404 recurso inexistente | Respuesta coherente |
| API-003 | Calidad | Validación DTO | 400 con detalle útil y no sensible |
| API-004 | Calidad | Content-Type JSON | Consistente en endpoints REST |
| API-005 | Calidad | CORS | Orígenes permitidos funcionan; política no accidentalmente insegura |
| AZ-001 | RQ-ARCH-07 | URL producción | API accesible por Internet |
| AZ-002 | RQ-ARCH-07 | HTTPS | HTTPS válido y usable |
| AZ-003 | RQ-ARCH-03 | Azure SQL desde producción | API publicada opera contra Azure SQL |
| AZ-004 | RQ-AUTH | Login producción | JWT funciona en Azure |
| AZ-005 | RQ-ROOM-03 | SignalR producción | Negociación/conexión funciona en Azure |
