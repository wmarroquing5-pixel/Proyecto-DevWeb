# Proyecto Clínica y Farmacia

## Tecnologías

- .NET 10
- ASP.NET Core Web API
- Entity Framework Core
- Azure SQL Database
- JWT
- SignalR

## Regla crítica

La base de datos existente es inmutable.

Está prohibido:

- crear tablas;
- eliminar tablas;
- agregar columnas;
- eliminar columnas;
- modificar tipos de datos;
- modificar claves primarias;
- modificar claves foráneas;
- modificar constraints;
- modificar índices;
- crear triggers;
- crear migraciones que alteren la BD;
- ejecutar Database.Migrate();
- ejecutar Database.EnsureCreated();

La API debe adaptarse exactamente al esquema existente.

Toda validación adicional debe implementarse en C#.

## Forma de trabajar

Antes de modificar código:

1. Analiza solamente los archivos necesarios.
2. Identifica qué ya funciona.
3. Reutiliza el código correcto.
4. Realiza cambios mínimos.
5. No reconstruyas componentes funcionales sin necesidad.

Después de cada cambio:

1. Ejecuta dotnet restore.
2. Ejecuta dotnet build.
3. Ejecuta las pruebas relacionadas si existen.
4. Corrige únicamente errores relacionados con el cambio.
5. Verifica que no se haya modificado la base de datos.

## Arquitectura

Frontend
→ API REST .NET 10
→ Entity Framework Core
→ Azure SQL Database

El frontend nunca accede directamente a la base de datos.

## Seguridad

Nunca guardar en el repositorio:

- contraseñas;
- cadenas de conexión reales;
- JWT SigningKey;
- secretos de Azure.

Usar configuración externa.

## Desarrollo

Utilizar:

- DTO;
- servicios;
- async/await;
- CancellationToken cuando corresponda;
- ProblemDetails;
- JWT;
- permisos dinámicos.

Evitar lógica de negocio dentro de Controllers.

## Regla de alcance

Implementar solamente el módulo solicitado en cada tarea.

No continuar automáticamente con otros módulos.

Si una funcionalidad parece requerir modificar la base de datos:

1. detener esa modificación;
2. mantener intacta la BD;
3. implementar la alternativa desde la API cuando sea posible;
4. informar la limitación.