# WEB-TRAT-06A — Decisiones pendientes y bloqueos

**No existe aprobación farmacéutica, clínica, DBA o de excepción a Azure SQL en estos documentos.** `WEB-TRAT-04/ACTA-DECISION.md` aprobó únicamente preparación documental; `WEB-TRAT-05`/`06A` tampoco autorizan implementación. La evidencia SSMS de `DB-AUDIT-AZURE-02/FINAL.md` fue aportada por el usuario, no consultada por Codex.

| ID | Decisión humana / evidencia faltante | Responsable propuesto | Impacto mientras está pendiente |
|---|---|---|---|
| U1 (D05/D-U1) | A: instantánea ampliada con fuente gobernada, o B: catálogo versionado como estructura adicional; aprobar concentración, unidad física, factor con sentido, producto/lote, fuente, vigencia, responsable y trazabilidad. | Farmacia, clínica, arquitectura y propietario/DBA para cualquier estructura. | Medicamento ambiguo bloqueado; DDL no listo para flujo farmacológico completo. |
| U2 | Fraccionamiento, mínima unidad, redondeo, tolerancias, frecuencia/duración y si externo satisface prescripción. | Farmacia y clínica. | No calcular ni dispensar cantidades derivadas. |
| I1 (D03/D10) | Aceptar control de escritura exclusivo por servicios C# con reconciliación, o autorizar integridad declarativa adicional en tablas actuales. | Arquitectura, seguridad, DBA, propietario. | Misma consulta y mismo medicamento/lote no están garantizados frente a DML ajeno. |
| E1 (D04/D13) | Estados/transiciones de receta, consulta `Cerrada`/`NULL`, sustitución después de suministro y saldos entre versiones. | Clínica y farmacia. | No operar nueva receta/entrega/acto ni sustitución hasta política. |
| C1 (D12) | Corrección, devolución apta, reintegro, movimiento compensatorio, doble control y efecto en saldos. | Clínica, farmacia y seguridad. | `CorreccionClinica` solo borrador; no habilitar endpoint ni reintegro. |
| P1 (D11) | Permisos de prescripción, entrega, administración, consulta y corrección; segregación por persona/sucursal sin modificar 67 asignaciones por inferencia. | Seguridad y propietario. | Ningún nuevo privilegio operativo aprobado. |
| T1 (D09) | Revisar índices, plan de bloqueos, colisiones de clave, `ExecutionStrategy`, ventas/consumo legado y conciliación en SQL Express aislado. | DBA, API y QA. | Atomicidad/idempotencia del nuevo flujo no probadas. |
| S1 (D02/D14) | Cotejo remoto restante: longitudes/precisión, posibles equivalentes, índices, PK/FK base; excepción expresa por entorno y objeto para cualquier DDL futuro. | DBA y propietario de datos. | Azure SQL permanece inmutable; el script no es desplegable. |
| L1 (D16) | Guard contra `PUT`/consumo legado en tratamientos gestionados y preservación de históricos. | API y responsable clínico. | Riesgo de doble libro si se implementase B sin guard; no cambiar endpoints ahora. |
| X1 | Autorizar separadamente cualquier instalación, creación de base, DDL y pruebas de escritura sintética en SQL Server Express local, con instancia/base exactas. | Propietario y DBA. | WEB-TRAT-06A solo documentación; WEB-TRAT-06B no iniciada. |

**Ampliación de modelo:** B de U1 implicaría al menos una octava tabla propuesta; no se creó ni añadió al DDL. A exigiría completar campos dentro de `RecetaLinea` propuesta y una fuente aprobada verificable; tampoco se añadió automáticamente. La imposibilidad de imponer todas las igualdades cruzadas con las siete tablas bajo esquema existente inmutable está documentada en `INTEGRIDAD-RELACIONAL.md`.

**Pruebas pendientes:** revisión por DBA con motor Express, SQL sintético de restricciones y transacciones, carreras con venta/consumo, unidades/lotes divergentes, recuperación e idempotencia; todas requieren autorización futura. No hay pruebas de escritura ejecutadas ni aprobación tácita.

**Estado:** `WEB-TRAT-01` bloqueado; `WEB-TRAT-06B` no iniciado.
