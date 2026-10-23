# WEB-TRAT-06A — Unidades y equivalencias farmacéuticas

**Estado:** revisión documental. Ninguna equivalencia está aprobada ni se habilita dispensación/administración. Fuentes: `WEB-TRAT-03/DISENO-FINAL.md`, `WEB-TRAT-04/ACTA-DECISION.md` (D05), `WEB-TRAT-05/DISENO-FISICO.md`, `C:\Users\DESARROLLO\Desktop\script.sql` y entidades `Medicamento`/`LoteMedicamento`. Los metadatos de Azure citados en `DB-AUDIT-AZURE-02/FINAL.md` fueron obtenidos por el usuario mediante SSMS; Codex no consultó Azure.

## Evidencia comprobada y límite

`LoteMedicamento.IdMedicamento` identifica el producto y `CantidadDisponible` es `int`; `Medicamento.Presentacion` es descriptiva. El esquema/código inspeccionado no aportan concentración, unidad física descontable, factor de conversión, regla de fraccionamiento ni una fuente farmacéutica versionada. Las seis columnas opcionales de la instantánea propuesta en `WEB-TRAT-05/RecetaLinea` (`ContenidoPorUnidad`, `UnidadContenido`, `FuenteEquivalencia`, `VersionEquivalencia`, `IdUsuarioValidador`, `FechaValidacionUtc`) solo prueban que alguien guardó una declaración completa; **no prueban su validez clínica, procedencia o vigencia por lote**. `CantidadPrescritaUnidades` es entera y no debe confundirse con `Dosis` decimal.

## Modelo de equivalencia propuesto, aún no aprobado

Para cada medicamento y, cuando cambie formulación o envase, para cada lote: identificador de medicamento/lote, presentación comercial validada, concentración numérica y unidad de concentración, unidad física que descuenta `CantidadDisponible`, contenido por unidad física y su unidad, dosis/pauta y unidad de dosis, factor explícito y sentido de conversión, permiso de fraccionamiento, mínima unidad dispensable, regla de redondeo, fuente documental verificable, vigencia, versión, fecha UTC y responsable farmacéutico. Una receta conservaría una instantánea inmutable del conjunto usado, con hash/referencia a la fuente. Farmacia debe decidir si una variación de lote exige nueva validación o bloquea la línea.

**Cálculo candidato solo para validar, nunca ejecutar sin política:** convertir la dosis a la unidad de contenido mediante una equivalencia dimensional aprobada; `unidadesFisicasExactas = dosisEnUnidadContenido / contenidoPorUnidadFisica`. Multiplicar por frecuencia y duración únicamente si la pauta los define de forma inequívoca. Aceptar `CantidadPrescritaUnidades` solo si el resultado, redondeo y fraccionamiento aprobados coinciden con la unidad física que descuenta el lote. No usar coma flotante ni truncamiento implícito; fijar escala decimal, límites y regla para dosis parciales. El factor podría representarse como `unidades físicas por unidad de dosis`, pero debe registrarse junto con **ambas unidades y el sentido** para evitar invertirlo. Los campos actuales no guardan todo este conjunto.

Ejemplos conceptuales, no pautas clínicas: una etiqueta `500 mg/tableta` no demuestra que el lote se gestione en tabletas ni que pueda partirse; un frasco `100 mg/5 ml` no demuestra si el inventario descuenta frascos o ml. Incluso la equivalencia aparentemente 1:1 exige validación de farmacia. Si las unidades son incompatibles, la fuente no está vigente, el lote difiere o el resultado no cabe en unidades permitidas, **bloquear receta, entrega y administración del medicamento en el flujo nuevo**; no usar `Medicamento.Presentacion` para completar huecos.

## Alternativas a decidir

| Aspecto | A. Instantánea ampliada en `RecetaLinea` | B. Catálogo independiente versionado |
|---|---|---|
| Persistencia | Añadir a la tabla **propuesta** campos para presentación/concentración, unidad física, factor con sentido, fraccionamiento, redondeo y referencia documental; seis campos de WEB-TRAT-05 son insuficientes. No altera tablas actuales. | Requiere al menos una **octava estructura propuesta** con clave de producto/lote o versión, vigencia y aprobador; cada línea referencia versión y conserva instantánea histórica. No se agregó al DDL. |
| Ventaja | Historia de la regla usada junto a cada línea; evita catálogo SQL nuevo. | Revisión central, reutilización y revocación/versionado controlados; facilita evitar divergencias entre prescripciones. |
| Límite | Sin fuente maestra gobernada, copiar una instantánea solo reproduce un dato no comprobado; cambios de lote exigen revalidación. | Amplía el modelo de siete tablas y necesita autorización expresa de estructura, flujo de aprobación y acceso; una FK por sí sola no valida la dosis del acto. |
| Control mínimo | Fuente externa aprobada y versionada, actor farmacéutico, cotejo de lote en cada salida, hash de evidencia y conciliación. | Alta/aprobación segregada, versiones inmutables, vigencias sin solapamiento, lote y fuente verificables, snapshot en línea. |
| Situación | **No elegida.** Los campos nuevos precisos dependen de política clínica y farmacia. | **No elegida.** No hay autorización para octava tabla ni catálogo vigente. |

## Decisiones humanas y pruebas pendientes

- **D-U1:** farmacia y responsable clínico definen producto/lote, unidad descontable, concentración, factor, fraccionamiento, redondeo, dosis máximas y evidencia fuente. Arquitectura/DBA eligen A o B **después** de esa decisión; el propietario autoriza cualquier ampliación de estructura. No tratar el silencio como aprobación.
- **D-U2:** definir si unidades externas o aportadas por paciente satisfacen la receta sin salida de inventario. La política actual las mantiene separadas.
- Pruebas futuras en SQL Server Express aislado y datos sintéticos: 1:1 validado, conversión dimensional válida, unidad incompatible, lote de otra concentración, cambio de versión, fuente revocada, dosis fraccionaria, redondeo al límite, overflow decimal/int y reintento tras cambio de catálogo. **No ejecutadas en WEB-TRAT-06A.**

No se modificó API, esquema, permisos ni inventario. `WEB-TRAT-01` sigue bloqueado.
