---
name: api-rest-clinica-audit
description: Audita y prueba el backend REST .NET 10 del proyecto Clínica/Farmacia 2026. Úsala para revisar arquitectura, compilación, EF Core/Azure SQL, JWT, permisos dinámicos, CRUD, reglas de negocio, SignalR, Docker, despliegue Azure y contrato de consumo web/móvil; genera un catálogo de pruebas y evidencias sin asumir que compilar equivale a cumplir.
---

# API REST Clínica/Farmacia — Auditoría y pruebas

## Objetivo

Evaluar de forma repetible si la API del proyecto final cumple los requisitos funcionales, técnicos, de seguridad y despliegue definidos para la solución Clínica/Farmacia.

La auditoría debe producir resultados verificables, reproducibles y trazables contra requisitos. No declares un requisito como cumplido sin evidencia suficiente.

## Archivos de apoyo obligatorios

Antes de iniciar, lee:

1. `references/project-requirements.md`
2. `references/test-catalog.md`
3. `assets/audit-report-template.md`
4. `assets/evidence-matrix.csv`

## Principios de ejecución

- Trabaja sobre el repositorio actual. No reconstruyas la solución si no es necesario.
- Prioriza cambios mínimos y localizados cuando el usuario pida correcciones.
- Durante una auditoría, no alteres datos productivos ni el esquema de base de datos salvo autorización explícita.
- No expongas secretos, contraseñas, connection strings completas, JWT, claves de firma ni credenciales en informes.
- En pruebas destructivas, utiliza datos de prueba identificables y elimina solo lo creado por la prueba cuando sea seguro.
- Si un endpoint o módulo no existe, regístralo como `NO IMPLEMENTADO`; no inventes rutas.
- Si una prueba no puede ejecutarse por falta de credenciales, infraestructura o datos, márcala `BLOQUEADA`, indicando exactamente qué falta.
- Un `HTTP 200` no implica automáticamente que la regla de negocio sea correcta. Verifica efectos, persistencia, autorización y consistencia.
- No marques `APROBADO` por inspección superficial cuando el requisito exige comportamiento en ejecución.

## Estados permitidos

Usa exclusivamente:

- `APROBADO`: evidencia completa y resultado esperado confirmado.
- `FALLIDO`: la funcionalidad existe pero incumple el resultado esperado.
- `NO IMPLEMENTADO`: falta la funcionalidad requerida.
- `BLOQUEADA`: no fue posible ejecutar por una dependencia externa o dato ausente.
- `NO APLICA`: solo cuando el requisito realmente no corresponda al alcance evaluado; justificar.

## Severidad de hallazgos

- `CRÍTICA`: compromete autenticación/autorización, integridad de datos, reglas clínicas/farmacia esenciales o impide operar/publicar la API.
- `ALTA`: incumple un requisito obligatorio o rompe un flujo principal.
- `MEDIA`: comportamiento incorrecto con alternativa o impacto limitado.
- `BAJA`: calidad, mantenibilidad, validación secundaria o documentación sin impacto funcional inmediato.

## Flujo obligatorio de auditoría

### 1. Inventario del repositorio

Identifica sin modificar:

- archivo `.sln` y proyectos `.csproj`;
- Target Framework;
- paquetes NuGet principales;
- `Program.cs`;
- controladores/endpoints;
- entidades/modelos y `DbContext`;
- servicios de autenticación/autorización;
- políticas, filtros o middleware de permisos;
- hubs de SignalR;
- configuración OpenAPI/Swagger;
- `Dockerfile` y `.dockerignore`;
- archivos de configuración;
- pruebas existentes;
- mecanismo de despliegue si está presente.

Entrega un mapa `Requisito -> Componente -> Estado de implementación`.

### 2. Seguridad previa

Antes de ejecutar:

- Detecta secretos hardcodeados.
- No los reproduzcas en salida.
- Verifica que la API no registre contraseñas ni tokens completos.
- Identifica el método de hash de contraseñas.
- Verifica que las rutas sensibles no sean anónimas accidentalmente.

Si aparecen credenciales reales, informa archivo y ubicación aproximada, pero redacta el valor.

### 3. Compilación y análisis estático

Ejecuta, según corresponda:

```bash
dotnet --info
dotnet restore
dotnet build --configuration Release
```

Si hay pruebas automatizadas:

```bash
dotnet test --configuration Release
```

Registra errores y warnings relevantes. No corrijas automáticamente durante una auditoría pura.

### 4. Arranque controlado

Inicia la API en Development o Testing cuando sea seguro. Captura:

- URL/puerto;
- endpoint OpenAPI/Swagger;
- errores de arranque;
- proveedor EF Core;
- conectividad de base de datos mediante un mecanismo no destructivo.

No ejecutes migraciones automáticamente contra Azure SQL salvo autorización explícita.

### 5. Ejecutar catálogo de pruebas

Usa `references/test-catalog.md` como catálogo mínimo. No omitas categorías. Puedes agregar pruebas derivadas del código o defectos encontrados, con IDs `EXT-###`.

Orden recomendado:

1. Arquitectura y plataforma.
2. Salud y persistencia.
3. Autenticación JWT.
4. Autorización y permisos dinámicos.
5. CRUD por módulo.
6. Reglas de negocio.
7. Concurrencia e integridad.
8. SignalR.
9. Contrato web/móvil.
10. Docker.
11. Azure/producción.
12. Seguridad técnica y manejo de errores.

### 6. Pruebas de API

Para cada caso registra como mínimo:

- ID;
- requisito;
- endpoint/método;
- precondiciones;
- datos de entrada no sensibles;
- resultado esperado;
- resultado real;
- código HTTP;
- efecto en base de datos si aplica;
- evidencia;
- estado;
- severidad si falla.

Verifica códigos HTTP coherentes:

- `200/201/204` para éxito según operación;
- `400` para datos inválidos;
- `401` sin autenticación o token inválido;
- `403` autenticado sin permiso;
- `404` cuando el recurso no existe;
- `409` para conflictos de estado/concurrencia cuando sea la estrategia elegida;
- `500` nunca debe ser la respuesta normal para validaciones de negocio esperables.

### 7. JWT

Confirma en ejecución:

- login contra base de datos;
- rechazo de credenciales incorrectas;
- generación de JWT firmado;
- token requerido en recursos protegidos;
- rechazo de token ausente, alterado y expirado;
- claims mínimos necesarios;
- validación de vigencia;
- ausencia de información sensible innecesaria dentro del token.

No muestres el JWT completo en el informe.

### 8. Permisos dinámicos

Debe existir un modelo de permisos almacenado en base de datos y evaluado en tiempo de ejecución.

Comprueba como mínimo las operaciones por módulo:

- Consultar;
- Crear;
- Modificar;
- Eliminar.

Prueba que un cambio de permiso surta efecto sin recompilar la API. Busca y reporta cualquier autorización hardcodeada por usuario o rol que contradiga el requisito de permisos dinámicos.

### 9. CRUD y reglas funcionales

Ejecuta casos positivos y negativos para:

- Pacientes.
- Medicamentos/productos y lotes.
- Empleados.
- Habitaciones y asignaciones.
- Historial clínico, consultas, diagnósticos, tratamientos, exámenes y evolución.
- Ventas de farmacia y detalle.
- Sucursales/Multi-Clínicas si el modelo las expone.

Valida relaciones y consistencia después de cada escritura.

### 10. Reglas de negocio obligatorias

Debes probar explícitamente:

- no vender sin existencia;
- no vender/usar lotes vencidos;
- descontar existencia al registrar venta;
- impedir doble asignación de habitación ocupada;
- registrar ingreso y egreso;
- restringir diagnóstico a quien posea permiso;
- validar JWT y permisos antes de ejecutar recursos protegidos;
- validar existencia antes de confirmar venta.

Cuando pruebes inventario, compara cantidad antes y después. Una venta exitosa sin decremento exacto es `FALLIDO`.

### 11. Concurrencia

Cuando sea posible, ejecuta dos solicitudes simultáneas sobre el mismo recurso para detectar:

- sobreventa;
- stock negativo;
- doble ocupación de habitación;
- pérdida de actualización.

Si no existe estrategia explícita de concurrencia, documenta el riesgo aunque las pruebas secuenciales pasen.

### 12. SignalR

Para habitaciones valida:

- Hub accesible y configurado;
- autenticación/autorización si corresponde;
- cliente puede conectarse;
- cambio de estado genera notificación;
- dos clientes reciben actualización sin recargar;
- reconexión razonable;
- la fuente de verdad final coincide con base de datos.

### 13. Contrato para frontend y móvil

Comprueba que la API exponga datos suficientes para el consumo requerido.

Para catálogo móvil de farmacia, verifica al menos:

- nombre;
- precio;
- marca;
- descripción;
- existencia;
- imagen o referencia de imagen;
- detalle por producto;
- filtros por nombre, marca y categoría.

No exige que la aplicación móvil esté dentro del repositorio de la API; sí exige que el contrato de la API pueda soportarla.

### 14. Docker

Ejecuta cuando Docker esté disponible:

```bash
docker build -t clinica-api-audit .
docker run --rm -p 8080:8080 --env-file <archivo-seguro> clinica-api-audit
```

Ajusta puertos/env según el proyecto. Verifica:

- build exitoso;
- proceso inicia;
- API responde desde contenedor;
- configuración mediante variables de entorno;
- no hay secretos incluidos en la imagen/repositorio;
- `.dockerignore` razonable.

No marques Docker aprobado solo porque existe `Dockerfile`.

### 15. Azure

Si se proporciona URL pública, prueba por HTTPS:

- disponibilidad de API;
- endpoint público esperado;
- autenticación;
- endpoint protegido;
- CORS desde origen permitido si aplica;
- conectividad con Azure SQL;
- SignalR si corresponde;
- ausencia de errores detallados de Development en producción.

No cambies configuración de Azure durante la auditoría salvo solicitud expresa.

### 16. Auditoría de calidad de API

Revisa:

- async/await en I/O;
- DTOs para evitar sobreexposición;
- validación de entrada;
- manejo global consistente de errores;
- cancelación/timeouts cuando aplique;
- consultas EF Core razonables;
- transacciones en flujos que actualizan múltiples entidades;
- N+1 evidentes;
- serialización circular;
- paginación donde una colección pueda crecer;
- CORS;
- Swagger/OpenAPI;
- logging sin datos sensibles.

No conviertas recomendaciones de calidad en requisitos obligatorios del proyecto salvo que deriven de un requisito funcional/técnico.

## Reglas de decisión

### Requisito global aprobado

Un requisito global solo puede ser `APROBADO` cuando todos sus casos obligatorios estén aprobados o exista evidencia equivalente.

### Seguridad

Cualquier bypass reproducible de autenticación o permisos es `CRÍTICA` aunque el resto del CRUD funcione.

### Inventario/ventas

Stock negativo, venta de lote vencido o venta sin existencia son fallos `CRÍTICA` o `ALTA` según impacto y alcance.

### Habitaciones

Doble asignación simultánea de habitación ocupada es como mínimo `ALTA`.

## Entregable final obligatorio

Genera un informe usando `assets/audit-report-template.md` con:

1. Resumen ejecutivo factual.
2. Alcance realmente probado.
3. Entorno y versión.
4. Matriz de cumplimiento por requisito.
5. Catálogo ejecutado con estado.
6. Hallazgos priorizados.
7. Evidencias.
8. Pruebas bloqueadas y razón.
9. Cambios realizados, solo si el usuario solicitó correcciones.
10. Reprueba posterior a los cambios.

Incluye totales de `APROBADO`, `FALLIDO`, `NO IMPLEMENTADO` y `BLOQUEADA`, pero no ocultes fallos detrás de un porcentaje general.

## Modo corrección

Solo si el usuario pide corregir:

1. Reproduce primero el fallo.
2. Identifica causa raíz.
3. Realiza el cambio mínimo.
4. Compila.
5. Ejecuta la prueba específica.
6. Ejecuta regresión de los flujos relacionados.
7. Registra archivos modificados y motivo.

No cambies contratos públicos, esquema SQL ni arquitectura sin necesidad comprobada y autorización cuando pueda romper consumidores existentes.
