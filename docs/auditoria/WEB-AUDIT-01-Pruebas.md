# WEB-AUDIT-01 — Pruebas, calidad y rendimiento

Fecha de ejecución: 18 de octubre de 2026.

## 1. Entorno de validación

| Herramienta | Versión utilizada/resuelta |
|---|---:|
| Windows | Entorno local del proyecto |
| Node.js | 24.18.0 |
| npm | 11.16.0 |
| Angular core | 18.2.14 |
| Angular CLI | 18.2.21 |
| TypeScript | 5.5.4 |
| Jasmine | 5.2.0 |
| Karma | 6.4.4 |
| Chrome Headless | 155.0.0.0 |

El CLI declara compatibilidad con Node `^18.19.1 || ^20.11.1 || >=22.0.0` y npm `^6.11.0 || ^7.5.6 || >=8.0.0`. Para reproducibilidad conviene fijar una versión LTS en documentación/CI, aunque el entorno actual satisface la expresión declarada.

## 2. Ejecuciones realizadas

| Comando/comprobación | Resultado | Evidencia y límite |
|---|---|---|
| `npm run verify` | Aprobado | 27 plantillas, 0 problemas; `ng build` producción aprobado |
| `npm test -- --watch=false --browsers=ChromeHeadless` | Aprobado | 14/14 pruebas; Chrome requirió ejecución fuera del sandbox |
| `npm audit --omit=dev --json` | Hallazgos | Código 1 esperado: 8 paquetes vulnerables, 4 high y 4 moderate |
| Grafo de imports relativos/dinámicos | Aprobado con deuda | 0 ciclos; 6 archivos desconectados |
| Health local `http://localhost:5293/health/live` | No ejecutable | El equipo rechazó la conexión; la API no estaba iniciada |
| E2E CRUD y SignalR | No ejecutado | Requería API y credenciales; no se realizaron escrituras ni acceso a Azure SQL |

No se ejecutó `npm ci`, porque las dependencias ya estaban instaladas y la auditoría prohíbe regenerar o instalar sin necesidad. No se ejecutaron migraciones, `Database.Migrate`, `EnsureCreated` ni pruebas que escribieran datos reales.

## 3. Resultado de compilación

- Bundle inicial bruto: **676.11 kB**.
- Transferencia estimada inicial: **131.44 kB**.
- CSS global: **315.73 kB** bruto / **32.95 kB** estimado.
- Se generan al menos 25 chunks lazy; el mayor mostrado es habitaciones con **73.40 kB** bruto.
- Presupuesto inicial configurado: aviso 1 MB, error 2 MB. El bundle está dentro del límite.
- Presupuesto por estilo de componente: aviso 6 kB, error 10 kB.
- `outputHashing: all` está activo en producción.

Advertencia conservada:

```text
1 rules skipped due to selector errors:
.form-floating>~label -> Did not expect successive traversals.
```

La advertencia procede del procesamiento de Bootstrap y no impide el build. Debe validarse visualmente cualquier `form-floating` y revisarse al actualizar Angular/build tools; no se debe editar `node_modules`.

## 4. Cobertura funcional de las pruebas existentes

Existen seis archivos spec con catorce casos:

| Área | Casos cubiertos |
|---|---|
| AppComponent | Creación, título y `router-outlet` |
| Auth guard | Permite sesión y redirige sin sesión |
| Interceptor JWT | Envía Bearer solo a la API y admite ausencia de token |
| Login | Flujo login → `/auth/me` → menú; rechazo 401 |
| Menú | Conserva elementos ya autorizados por la API aunque `/auth/me` no traiga roles |
| Habitaciones/SignalR | Carga HTTP + evento, lista vacía, token renovado consultado por factory y liberación del hub |

Ausencias relevantes:

- No hay pruebas de componentes/servicios para pacientes, empleados, usuarios, historial, inventario, lotes o ventas.
- No hay pruebas de permisos por operación ni actualización de permisos en sesión.
- No hay E2E ni runner E2E configurado.
- `karma-coverage` está instalado, pero no existe script, umbral ni reporte de cobertura disponible.
- No existe lint script ni configuración ESLint.
- No existe CI que ejecute build/pruebas de forma repetible.
- No hay prueba integrada del hub contra la API real.

## 5. Calidad estática

| Aspecto | Resultado |
|---|---|
| TypeScript estricto | Activo (`strict`, `strictTemplates`, `noImplicitReturns`) |
| Ciclos de imports | Ninguno detectado |
| Imports relativos inexistentes | Ninguno en el grafo alcanzable |
| Lazy loading | Generalizado en páginas |
| Tipado HTTP | DTO e interfaces en los servicios activos |
| `any` | Tres usos funcionales confirmados; uno adicional en módulo desconectado |
| Suscripciones persistentes | Habitaciones correctamente liberada; HTTP completa; módulo desconectado de movimientos requiere corrección |
| Manejo de errores | Repetido y heterogéneo; falta adaptador `ProblemDetails` |
| Código obsoleto | Seis archivos desconectados, dos de ellos vacíos |

## 6. Rendimiento y solicitudes

Fortalezas:

- Rutas lazy reducen el código inicial.
- No se observan librerías de estado pesadas.
- Servicios reutilizan contratos y `HttpClient`.
- El bundle queda por debajo del presupuesto configurado.

Riesgos:

- Bootstrap completo domina el CSS global aunque se use solo una parte de sus reglas.
- `DashboardComponent` puede solicitar el menú otra vez además de su carga al construir el servicio; no existe caché temporal explícita ni `shareReplay` para llamadas concurrentes.
- `consulta-detalle` dispara cuatro listados adicionales en paralelo y fija `pageSize: 100`; no gestiona páginas posteriores.
- Los catálogos descargan siempre la primera página de 100.
- `registrar-egreso-modal` busca la asignación activa únicamente en los primeros 100 registros.
- No hay medición Lighthouse, Web Vitals ni perfil de red; no corresponde inferir rendimiento en producción desde el tamaño del bundle.

## 7. Catálogo de pruebas pendiente

### P1 — antes de declarar integración funcional

1. Arrancar API con configuración local externa y base segura de prueba, sin migraciones.
2. Login válido/inválido, expiración JWT, 401, 403 y logout.
3. Menú para al menos Admin, Doctor y Recepcionista; cambio de permisos durante sesión.
4. Lecturas de pacientes, empleados, usuarios, habitaciones, inventario, historial y ventas.
5. SignalR con dos clientes: asignar/egresar, desconectar, reconectar y recargar snapshot.
6. Flujo de venta con lote vigente, lote vencido, stock insuficiente y dos ventas concurrentes en un entorno descartable.
7. Asignación simultánea de habitación desde dos clientes.

### P2 — automatización por módulo

| Módulo | Pruebas mínimas |
|---|---|
| Pacientes | paginación, validación, alta/edición y errores `ProblemDetails` |
| Empleados | catálogos, tipos exactos y campos condicionales por tipo |
| Usuarios | roles, contraseña opcional en edición y permisos de botones |
| Historial | consulta, diagnóstico, tratamiento, examen y evolución |
| Inventario | catálogo, filtros, lotes, `cantidadEsperada` y entradas |
| Ventas | filtros incluido `idPaciente`, carrito, límites de stock y detalle |
| Accesibilidad | navegación por teclado, foco en modales, nombres accesibles y contraste |

### P2 — infraestructura de calidad

- Añadir script de cobertura con umbrales acordados después de obtener una línea base.
- Incorporar ESLint sin reescribir masivamente código.
- Crear CI con `npm ci`, `npm run verify`, pruebas headless y auditoría controlada.
- Añadir E2E con datos descartables y prohibición explícita de ejecutarlo contra producción/Azure SQL real.

## 8. Dictamen

La aplicación **compila y sus catorce pruebas pasan**, pero la suite cubre principalmente infraestructura transversal. No hay evidencia suficiente para certificar los flujos de negocio de extremo a extremo. El estado correcto es: build probado, contratos inspeccionados, integración real pendiente.
