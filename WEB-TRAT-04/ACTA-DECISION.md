# WEB-TRAT-04 — Acta de decisión y autorización

**Fecha de preparación:** 22/10/2026 (zona `America/Guatemala`). **Carácter:** borrador formal para revisión; **sin firma ni aprobación de políticas clínicas, permisos, DDL o implementación**. `WEB-TRAT-04` queda documentalmente preparado al completar los cinco archivos. `WEB-TRAT-01` permanece bloqueado.

## 1. Alcance expresamente autorizado por el propietario en esta solicitud

| ID | Decisión expresa | Fuente | Efecto |
|---|---|---|---|
| A01 | Preparar aprobación formal mediante cinco documentos en `WEB-TRAT-04`. | Solicitud `WEB-TRAT-04 — Aprobación funcional y arquitectónica`. | **Autorizado solo trabajo documental.** |
| A02 | No ejecutar DDL ni escrituras sobre Azure SQL, migraciones, cambios de API/Angular, roles/permisos ni despliegues. | Restricciones de la misma solicitud y [`AGENTS.md`](../AGENTS.md). | **Prohibiciones vigentes.** |
| A03 | No interpretar esta solicitud como autorización de cambio de esquema; mantener WEB-TRAT-01 bloqueado. | Criterio y restricciones de la misma solicitud. | Implementación completa sigue detenida. |
| A04 | Conservar cambios previos del repositorio y verificar `git diff --check`. | Solicitud actual. | Ningún trabajo anterior se descarta. |

Estas son las únicas decisiones **expresamente aprobadas** para WEB-TRAT-04. La evidencia SSMS previa acredita observaciones de metadatos, no aprobación clínica o de DDL. Los cinco archivos de WEB-TRAT-03 son propuestas, no autorizaciones.

## 2. Registro de decisiones recomendadas y pendientes

**Estados:** `Recomendada — pendiente` significa propuesta técnica sin aprobación; `Bloqueada` significa que no puede implementarse con la regla vigente o falta política esencial. Cambiar el estado exige decisión humana identificada y evidencia verificable; Codex no firma ni convierte silencio en aprobación.

| ID | Decisión para resolver | Recomendación documentada | Responsable de decidir | Estado hoy | Evidencia de aprobación exigida |
|---|---|---|---|---|---|
| D01 | Alcance: A actual o B persistencia ampliada | B es necesaria para WEB-TRAT-01 completo; A solo alcance reducido. | Propietario + responsable clínico | Recomendada — pendiente | Acta de alcance y requisitos aceptados. |
| D02 | Excepción a BD inmutable y objetos permitidos | No ejecutar B hasta excepción expresa con entorno, siete tablas/índices/FK/CHECK exactos y revisión DBA. | Propietario de datos + DBA | **Bloqueada** | Autorización firmada que modifique explícitamente la prohibición aplicable; no basta aprobar este diseño. |
| D03 | Relación diagnóstico–tratamiento–receta | Exigir diagnóstico/tratamiento de la misma consulta, ID real, médico responsable. | Responsable clínico + arquitectura | Recomendada — pendiente | Regla clínica y criterio de pertenencia aprobados. |
| D04 | Estados de receta y consulta | Propuesta `Vigente/Sustituida/Anulada`; no operar en `Cerrada`/`NULL` hasta política; estados de entrega/administración derivados. | Responsable clínico | Recomendada — pendiente | Tabla de transiciones, cierre y tratamiento histórico aprobada. |
| D05 | Unidad de inventario y dosis | Fuente de equivalencia versionada por producto/lote; no inferir de `Presentacion`; bloquear conversiones ambiguas. | Farmacia + responsable clínico + arquitectura | **Bloqueada para productos ambiguos** | Catálogo/factor/fuente/instantánea y reglas de redondeo/fraccionamiento aprobados. |
| D06 | Cómo vincular Tratamiento y Receta | Preferir una sola transacción para creación conjunta o vincular uno existente validado; evitar dos commits. | Arquitectura/API + propietario | Recomendada — pendiente | Contrato final y casos de fallo aprobados. |
| D07 | Entregas parciales y pendiente | Saldos por línea: prescrito − entregado − directo, con eventos confirmados y no compensados. | Farmacia + responsable clínico | Recomendada — pendiente | Fórmula final, manejo de externos y correcciones aprobados. |
| D08 | Administración de tres orígenes | Directa descuenta una vez; entrega previa no descuenta; externa no usa stock interno. | Enfermería + farmacia + responsable clínico | Recomendada — pendiente | Protocolo de acto, dosis, fuente y responsable aprobado. |
| D09 | Idempotencia/concurrencia | UUID+hash UNIQUE, transacción completa, saldos y stock bloqueados, relectura tras conflicto. | Arquitectura + DBA | Recomendada — pendiente | Diseño de índices/transacciones revisado y pruebas SQL aisladas aprobadas. |
| D10 | Integridad cruzada entre tablas | Decidir exclusividad de escritura vía API o ampliar excepción a índices/llaves compuestas en tablas existentes. | DBA + arquitectura + propietario | **Bloqueada** | Decisión explícita y pruebas de invariantes; FK simples no bastan. |
| D11 | Permisos/roles/segregación | Módulos independientes y mínimo privilegio; admin no prescribe por defecto; no alterar 67 asignaciones automáticamente. | Seguridad + propietario + áreas clínicas | Recomendada — pendiente | Matriz final por rol/persona, delegaciones y pruebas RBAC. |
| D12 | Correcciones/devoluciones/reintegros | Append-only; reintegro solo con retorno físico apto y movimiento compensatorio; no habilitar endpoint antes de protocolo. | Responsable clínico + farmacia + seguridad | **Bloqueada** | Protocolo de anulación, devolución, supervisión, tipo de movimiento y conciliación. |
| D13 | Versiones con entregas previas | Bloquear sustitución tras suministro hasta definir traslado/ajuste de saldos. | Responsable clínico + farmacia | Bloqueada | Política de continuidad y corrección aprobada. |
| D14 | Metadatos remotos restantes | Cotejar longitudes/precisión, índices y posibles equivalentes con identidad restringida. | DBA | Pendiente de evidencia | Exportación de catálogo sin datos clínicos, origen/procedencia documentados. |
| D15 | Respaldo, despliegue, reversión | Probar primero en SQL Server aislado; no borrar eventos confirmados al revertir. | DBA + operaciones + propietario | Bloqueada hasta D02–D14 | Plan revisado, backup restaurado y autorizaciones de entorno. |
| D16 | Históricos | Mantener `POST /consumos` para legados y bloquearlo en gestionados; no atribuir movimientos antiguos por heurística. | Arquitectura/API + responsable clínico | Recomendada — pendiente | Criterios de clasificación y pruebas de compatibilidad. |

## 3. Observaciones verificadas frente a decisiones

- **Verificado documentalmente:** `Tratamiento` no enlaza diagnóstico y tiene un lote/cantidad opcional; `MovimientoInventario` no identifica origen clínico; el endpoint de consumo hace una salida por solicitud. Se cotejó código local y evidencia SSMS **aportada por el usuario** en [`DB-AUDIT-AZURE-02/FINAL.md`](../DB-AUDIT-AZURE-02/FINAL.md). Codex no ejecutó consultas remotas.
- **No verificado aún:** equivalencia de unidades/dosis, permisos/roles reales de farmacia y enfermería, política clínica de estados y correcciones, integridad de futuras tablas en Azure, idempotencia y pruebas de concurrencia. El diseño describe cómo probarlas, no que ya funcionen.
- **Propuesta:** siete estructuras de [`WEB-TRAT-03/DISENO-FINAL.md`](../WEB-TRAT-03/DISENO-FINAL.md) con permisos de [`MATRIZ-PERMISOS.md`](MATRIZ-PERMISOS.md); su aprobación **no** se presume por la recepción de este informe.

## 4. Puertas formales para una futura autorización de implementación

1. **Acta funcional:** propietario, responsable clínico, farmacia y enfermería resuelven D03–D08, D12–D13; identifican nombres/cargos/fecha. No usar este archivo como firma implícita.
2. **Acta de seguridad:** D11 con asignaciones exactas y revisión de segregación; sin cambios automáticos de las 67 existentes.
3. **Acta de datos/DBA:** D02, D10 y D14; especifica servidor/base/entorno, objetos DDL permitidos, scripts revisados, backup/rollback y ventana. Una aprobación conceptual del modelo B no autoriza ejecutar DDL.
4. **Orden técnica posterior:** alcance de API/WebClinica, pruebas SQL aisladas, criterios de aceptación y despliegue separados; D09, D15–D16. No iniciar código por la aprobación documental de WEB-TRAT-04.

**Campos de firma futuros (vacíos deliberadamente):** propietario del proyecto: ______; responsable clínico: ______; farmacia: ______; enfermería: ______; seguridad: ______; DBA: ______; fecha y referencia de autorización: ______.

## 5. Estado del corte

`WEB-TRAT-04`: **documentación preparada para revisión**, sin aprobación funcional o arquitectónica expresa de B. `WEB-TRAT-01`: **bloqueado**. Azure SQL, API-Clinica, WebClinica, roles, permisos y despliegues: **sin cambios por esta fase**.
