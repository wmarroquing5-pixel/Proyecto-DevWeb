# Requisitos trazables — Proyecto Clínica/Farmacia 2026

Fuente funcional: documento del Proyecto Final de Desarrollo Web 2026 entregado por el usuario.

## RQ-ARCH

- RQ-ARCH-01: Backend obligatorio .NET 10 mediante ASP.NET Core Web API REST.
- RQ-ARCH-02: Acceso a datos mediante Entity Framework Core.
- RQ-ARCH-03: Base de datos Azure SQL Database.
- RQ-ARCH-04: Arquitectura Frontend Web -> API REST .NET 10 -> EF Core -> Azure SQL.
- RQ-ARCH-05: Frontend no se conecta directamente a la base de datos.
- RQ-ARCH-06: Git para control de versiones y herramienta de seguimiento.
- RQ-ARCH-07: Solución publicada en Microsoft Azure y accesible por Internet.
- RQ-ARCH-08: API con Dockerfile funcional; demostrar build y ejecución en contenedor.

## RQ-AUTH

- RQ-AUTH-01: Formulario/flujo de login valida credenciales contra base de datos.
- RQ-AUTH-02: Usuario válido recibe JWT firmado.
- RQ-AUTH-03: Recursos protegidos requieren token.
- RQ-AUTH-04: API valida vigencia del token.
- RQ-AUTH-05: API valida permisos antes de responder/ejecutar operación protegida.

## RQ-PERM

- RQ-PERM-01: Alta de usuarios y roles.
- RQ-PERM-02: Permisos asignables a roles por módulo y operación.
- RQ-PERM-03: Operaciones mínimas: Consultar, Crear, Modificar, Eliminar.
- RQ-PERM-04: Permisos persistidos en base de datos.
- RQ-PERM-05: Cambios de permisos aplicados en tiempo real sin modificar código.
- RQ-PERM-06: No usar permisos hardcodeados por usuario como mecanismo principal.
- RQ-PERM-07: Frontend puede construir menú dinámico desde permisos.

## RQ-PAT

- RQ-PAT-01: CRUD de pacientes.
- RQ-PAT-02: Datos generales del paciente.
- RQ-PAT-03: Historial de consultas y tratamientos vinculado al paciente.

## RQ-INV

- RQ-INV-01: CRUD de medicamentos/productos de farmacia.
- RQ-INV-02: Registro de lotes.
- RQ-INV-03: Lote incluye número, medicamento, fecha ingreso, vencimiento y cantidad disponible.
- RQ-INV-04: Entradas y salidas por ventas o uso clínico.

## RQ-EMP

- RQ-EMP-01: CRUD de empleados.
- RQ-EMP-02: Doctores, enfermeras y personal administrativo.
- RQ-EMP-03: Especialidades y roles.

## RQ-ROOM

- RQ-ROOM-01: CRUD/control de habitaciones.
- RQ-ROOM-02: Estados libre, ocupada y en limpieza.
- RQ-ROOM-03: Actualización en tiempo real mediante ASP.NET Core SignalR.
- RQ-ROOM-04: Pacientes por habitación.
- RQ-ROOM-05: Asignación de paciente a habitación.
- RQ-ROOM-06: Fechas de ingreso y egreso.

## RQ-CLIN

- RQ-CLIN-01: Registro de consultas médicas.
- RQ-CLIN-02: Diagnósticos.
- RQ-CLIN-03: Tratamientos.
- RQ-CLIN-04: Exámenes con resultados y fecha.
- RQ-CLIN-05: Diagnósticos asignados por médicos.
- RQ-CLIN-06: Evolución/seguimiento médico.

## RQ-SALE

- RQ-SALE-01: Registrar venta y detalle.
- RQ-SALE-02: Detalle guarda cantidad, precio unitario, total y usuario.
- RQ-SALE-03: Venta descuenta automáticamente existencia del lote.
- RQ-SALE-04: Validar disponibilidad antes de completar venta.

## RQ-BR

- RQ-BR-01: No vender medicamento sin existencia disponible.
- RQ-BR-02: No vender ni utilizar medicamento de lote vencido.
- RQ-BR-03: Descontar existencia al registrar venta.
- RQ-BR-04: Habitación ocupada no puede asignarse a otro paciente.
- RQ-BR-05: Registrar fecha de ingreso y egreso.
- RQ-BR-06: Solo usuario con permiso puede registrar diagnóstico.
- RQ-BR-07: JWT y permisos se validan antes de operación protegida.

## RQ-MULTI

- RQ-MULTI-01: Solución contempla sucursales/Multi-Clínicas.
- RQ-MULTI-02: Los datos que deban pertenecer a una sucursal preservan aislamiento/relación correcta según modelo.

## RQ-MOB

- RQ-MOB-01: La misma API publicada sirve a la aplicación móvil.
- RQ-MOB-02: Producto expone nombre, precio, marca, descripción, existencia e imagen.
- RQ-MOB-03: Endpoint/contrato de detalle por producto.
- RQ-MOB-04: Filtros por nombre, marca o categoría.
