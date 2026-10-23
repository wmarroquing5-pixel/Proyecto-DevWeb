# DB-AUDIT-AZURE-02 — Identidad de auditoría y esquema real

**Estado: PENDIENTE / inspección remota detenida antes de conectar.** Fecha de la tarea: 22/10/2026 (America/Guatemala). No existe evidencia de una identidad independiente y autorizada disponible para esta auditoría. La instrucción recibida exige detenerse en ese caso; no se intentó conectar con `DefaultConnection` ni con otra identidad.

## A. Identidad y seguridad

| Comprobación local, sin leer valores secretos | Resultado |
|---|---|
| Configuración pública de `API-Clinica/appsettings.json` | Única **clave de conexión nombrada**: `DefaultConnection`. Esto no demuestra su valor ni sus privilegios; no se usó. |
| `API-Clinica/appsettings.Development.json` y `Properties/launchSettings.json` | No declaran perfil de conexión de auditoría. |
| Nombres de variables de entorno para auditoría, solo lectura, Azure SQL o `sqlcmd` | Sin coincidencias. No se mostraron valores. |
| Nombres de DSN ODBC coincidentes con auditoría, solo lectura o clínica | Sin coincidencias. No se inspeccionaron cadenas de conexión. |
| Archivos de perfil de auditoría identificables en el espacio de trabajo | Ninguno pertinente. Los archivos `audit.json` encontrados corresponden a auditorías npm del frontend, no a perfiles SQL. |
| Herramienta cliente | `sqlcmd` está instalada; su presencia no acredita un principal autorizado. |
| Antecedente | `DB-AUDIT-AZURE-01/FINAL.md` ya registraba la ausencia de perfil independiente y la prohibición de reutilizar la conexión productiva. |

No se abrió conexión. Por tanto, método de autenticación, identidad autenticada, servidor/base efectivos, cifrado de la sesión, pertenencia a roles, permisos efectivos y visibilidad de metadatos: **NO VERIFICABLES**. Los nombres de servidor y base que puedan aparecer en documentos previos no sustituyen una referencia de destino y principal aprobada para esta tarea. **Consultas remotas ejecutadas: 0. Escrituras, cambios de permisos y cambios de esquema: 0.**

## B. Esquema real

**No se obtuvo ningún metadato remoto.** Tablas, columnas, tipos, nulabilidad, claves, FK, índices, restricciones y diferencias frente a `C:\Users\DESARROLLO\Desktop\script.sql`: **NO VERIFICABLES en Azure SQL**. No se infiere la ausencia de un objeto por falta de visibilidad. La descripción de `WEB-TRAT-01/AUDITORIA.md` y `WEB-TRAT-02/DISENO.md` sigue siendo documental, basada en script, entidades y EF Core; no se actualizó como si se hubiera corroborado contra Azure.

## C. Matriz de compatibilidad con WEB-TRAT-02

| Capacidad | Evidencia documental del script/código | Estado del esquema Azure |
|---|---|---|
| Tratamiento por consulta y un lote opcional | `Tratamiento.IdConsulta`, `IdLote`, `Cantidad`; contrato de creación sin descuento | **No verificable** |
| Vínculo específico Tratamiento–Diagnostico | No consta FK ni `IdDiagnostico` en `Tratamiento` documental | **No verificable** |
| Receta con varias líneas/medicamentos | No consta cabecera o detalle de receta documental | **No verificable** |
| Entrega parcial con saldo por línea | No constan tablas de entrega o relación con receta documental | **No verificable** |
| Administración clínica separada | No consta evento estructurado documental | **No verificable** |
| Movimiento vinculado a operación de origen | `MovimientoInventario` documental identifica lote, usuario, sucursal, tipo, cantidad y fecha; no receta/entrega/administración | **No verificable** |
| Identidad de solicitud y unicidad antirrepetición | `IdMovimiento` nace después de la salida; el POST de consumo solo recibe cantidad | **No verificable** |
| Alternativa A | Según contrato actual, tratamiento simple y salida clínica independiente; no garantiza el flujo completo | **Parcial solo documental; no verificable remotamente** |
| Alternativa B | Propone nuevas estructuras, incompatibles con la regla actual de base inmutable | **Propuesta no autorizada; no verificable remotamente** |

La clasificación «no verificable» es deliberada: la comprobación remota es condición de aceptación y no ocurrió. No se afirma que Azure coincida o difiera del script.

## D. Riesgos mientras no exista auditoría remota

- **Integridad referencial:** no puede descartarse que haya relaciones adicionales o que falten restricciones respecto al script.
- **Duplicados:** el contrato actual de `POST /api/tratamientos/{id}/consumos` no proporciona una clave de solicitud; el `IdMovimiento` resultante no evita un segundo POST. No se probó el esquema remoto para detectar una protección adicional.
- **Concurrencia:** las transacciones del consumo existente protegen una salida individual, pero no modelan saldos de receta, entrega ni administración. No se ejecutaron pruebas SQL en esta tarea.
- **Trazabilidad:** el mapeo/documento no vincula el movimiento a su tratamiento u origen clínico; no es seguro reconstruirlo por lote, fecha o texto.
- **Permisos:** usar `DefaultConnection` podría exponer datos o capacidad de escritura. Sin principal restringido no se puede demostrar una auditoría de solo lectura.

## E. Procedimiento para el administrador autorizado — no realizado

1. Confirmar fuera de Codex el servidor y base exactos, alcance de objetos y plazo de la auditoría. Registrar una referencia de aprobación sin secretos.
2. Aprovisionar **fuera de esta tarea** un principal Microsoft Entra contenido dedicado; si no es viable, un usuario SQL contenido separado. No reutilizar la identidad de `DefaultConnection` ni agregar el principal a roles administrativos o de lectura de datos. La identidad deberá quedar limitada a una sola base y al mínimo `VIEW DEFINITION` que permita ver tablas, columnas, FK, índices y restricciones pertinentes.
3. Comprobar administrativamente permisos heredados por grupos y acceso indirecto; garantizar ausencia de `SELECT` sobre filas clínicas, `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `CONTROL`, permisos DDL, ejecución de procedimientos con capacidad de escritura y acceso innecesario a otras bases. El administrador conserva credenciales y registra una constancia sin valores secretos.
4. Configurar en el equipo un perfil **separado**, con nombre y mecanismo identificables, cifrado obligatorio y validación del certificado del servidor. Mantener tokens/cadenas de conexión fuera del repositorio, argumentos de proceso, informes y chat. Comunicar solo el nombre del perfil, método de activación, identidad esperada y referencia del destino autorizado.
5. Con esa confirmación, comprobar primero destino, identidad, cifrado y permisos efectivos con las consultas preparadas de `WEB-TRAT-02/DISENO.md`, sección 9.1. Suspender si un resultado es ambiguo, si hay permisos amplios o si el destino no coincide. Revisar `sys.fn_my_permissions` o privilegios heredados cuando `HAS_PERMS_BY_NAME` no dé una respuesta suficiente. No probar restricciones con DML.
6. Solo tras superar la puerta de seguridad, ejecutar las consultas **SELECT de catálogos** de la sección 9.2–9.4; registrar evidencia de columnas, relaciones, índices y restricciones, y comparar con script/EF/DTO. Si la visibilidad resulta parcial, clasificar esos objetos como «no verificables».

Este procedimiento solicita aprovisionamiento al administrador; **Codex no creó usuarios, concedió permisos ni configuró Azure SQL**. Hasta que exista el perfil y se ejecute la comparación, DB-AUDIT-AZURE-02 **no puede cerrarse**. WEB-TRAT-01 continúa bloqueada; esta auditoría no autoriza programación, DDL, cambios de RBAC ni cambios al endpoint de consumo.
