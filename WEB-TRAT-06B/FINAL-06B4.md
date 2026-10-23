# WEB-TRAT-06B-4 — Cierre de preparación documental

**Resultado:** preparados siete entregables para revisión. **No se ejecutó SQL** ni se abrió conexión a SQL Server o Azure SQL en esta fase. No se crearon identidades, permisos, tablas o datos; API-Clinica y WebClinica permanecen sin cambios. `WEB-TRAT-01` continúa bloqueado.

## Archivos creados

| Archivo | Contenido / estado |
|---|---|
| `DISENO-IDENTIDADES.md` | Grupos Windows propuestos, separación aprovisionamiento/pruebas y permisos mínimos. |
| `IDENTIDADES-PROPUESTAS.sql` | Borrador de logins/usuarios locales; `THROW` inicial, marcadores no aprobados y guardas. No ejecutado. |
| `ESQUEMA-SINTETICO-REVISADO.sql` | Siete bases y siete padres auxiliares mínimos; `THROW` inicial y guardas. No ejecutado. |
| `MATRIZ-DEPENDENCIAS.md` | PK, FK, tipos, nulabilidad, restricciones y dependencia de las siete tablas clínicas propuestas. |
| `PRECHECK-APROVISIONAMIENTO.sql` | Metadatos de solo lectura, también bloqueado por `THROW`; no ejecutado. |
| `PLAN-APROVISIONAMIENTO.md` | Puertas de autorización y orden futuro de identidades, esquema, DDL y pruebas. |
| `FINAL-06B4.md` | Este cierre documental. |

## Evidencia y límites

El cotejo utilizó `script.sql` del Escritorio (SHA256 `59AEA7DFC361E81FE865478D24F2750C40F2489F028B5EB5AD40847FD1FF19CB`), entidades y `ClinicaDbContext`, la evidencia SSMS **aportada por el usuario** en `DB-AUDIT-AZURE-02/FINAL.md`, y los scripts protegidos de 06A/06B. `script.sql` no se copió ni ejecutó. Los metadatos del SQL Express y la base vacía provienen de 06B-3; no se reconfirmaron en esta fase.

El esquema sintético **no** es clon de producción: añade siete stubs padre para conservar las FK relevantes, omite columnas y relaciones ajenas a las futuras pruebas y solo contiene definiciones, sin datos. Los campos `Consulta.EstadoConsulta`, `TemperaturaC` y `FrecuenciaCardiaca` provienen de EF/evidencia posterior y no del `script.sql` antiguo. Las siete tablas clínicas nuevas permanecen en borradores separados; ninguna se creó.

Quedan pendientes: aprobación de grupos y miembros, comprobación de permisos efectivos y ausencia de acceso a otras bases, autorización de ejecución, validación sintáctica en motor, decisiones clínicas de equivalencias/estados/correcciones, y pruebas estructurales/transaccionales. La identidad Windows observada en 06B-3 es `sysadmin`, inapropiada para pruebas habituales.

## Verificación de este corte

- Los tres SQL nuevos conservan `THROW` como primera instrucción SQL, sin separadores `GO` y con marcadores de identidad no aprobados.
- El esquema revisado declara 14 tablas, 17 referencias FK, ningún padre ausente y ningún nombre de restricción repetido según análisis estático. Esto no sustituye la validación sintáctica en SQL Server.
- No se encontraron credenciales, conexiones a Azure SQL, `DefaultConnection`, migraciones ni datos reales en los entregables.
- El hash SHA256 de `WEB-TRAT-06A/DDL-REVISADO.sql` sigue siendo `EF7322146A5D630F875E35553E25BF2D6ACE1E1C6A17C1B32AD13D906B5DECB2`. Los scripts originales no se editaron.
- `git diff --check` terminó correctamente. Como estos entregables están en un directorio aún no versionado, también se revisaron directamente sus siete archivos: cero espacios finales.

**Estado WEB-TRAT-06B-4:** preparación documental completada; aprovisionamiento y pruebas **no autorizados ni iniciados**. Se requiere autorización nueva y expresa antes de crear identidades, conceder permisos o crear tablas.
