# WEB-TRAT-06B-1 — Preparación y precheck de SQL Server Express aislado

**Estado WEB-TRAT-06B-1:** preparación documental completada conforme a la autorización actual. **Validación estructural real pendiente:** no se han creado las siete tablas ni ejecutado pruebas. `WEB-TRAT-01` sigue bloqueado; `WEB-TRAT-06B-2` no se inició.

## Evidencia local previa y alcance de esta intervención

En el **turno anterior**, Codex consultó solo metadatos de `localhost\SQLEXPRESS` en `master`: `DESKTOP-QTDJOHF\SQLEXPRESS`, Express, `EngineEdition=4`, versión `17.0.1145.4`, identidad `DESKTOP-QTDJOHF\DESARROLLO` con `sysadmin=1`; entonces la base candidata `ClinicaTratamiento_Aislado_06B` no existía. **En esta intervención no se abrió conexión ni se ejecutó SQL**, incluido el precheck nuevo. La evidencia previa no sustituye la futura reconfirmación. Los metadatos Azure de `DB-AUDIT-AZURE-02` proceden de SSMS del usuario.

## Nueve entregables y su estado

| Archivo | Estado |
|---|---|
| `PRECHECK-ENTORNO.md` | Evidencia previa distinguida del nuevo precheck no ejecutado. |
| `PRECHECK-ENTORNO.sql` | Solo metadatos; detiene por servidor/base/edición/identidad incorrectos o no aprobados; no ejecutado. |
| `ESQUEMA-AISLADO.sql` | Stubs mínimos sintéticos, `THROW` inicial, sin ejecutar. |
| `DDL-EJECUCION-AISLADA.sql` | Propuesta completa de las siete tablas, con `THROW` inicial y segunda barrera de entorno/identidad. No ejecutada; `WEB-TRAT-06A/DDL-REVISADO.sql` intacto. |
| `PRUEBAS-INTEGRIDAD.sql` | Casos sintéticos y ROLLBACK preparados con `THROW`; cero casos ejecutados. |
| `PRUEBAS-TRANSACCIONES.sql` | Casos básicos preparados con `THROW`; carreras de dos sesiones aún requieren arnés/identidad. |
| `RESULTADOS-PRUEBAS.md` | Evidencia histórica P01–P05 separada de todos los ensayos pendientes; ninguna aprobación inventada. |
| `INCIDENCIAS.md` | Bloqueos B01–B08 y límites de integridad. |
| `FINAL.md` | Este informe. |

## Límites de la validación

El esquema base propuesto es una **simulación mínima de claves**, no una copia del esquema real ni un entorno de datos clínicos. Incluso si el DDL supera pruebas estructurales futuras, las FK no garantizan igualdad de consulta tratamiento/diagnóstico ni igualdad de medicamento línea/lote; tampoco demuestran descuentos, equivalencias farmacéuticas, concurrencia de venta/consumo o seguridad de API. Esas garantías permanecen bloqueadas para cortes posteriores.

## Verificación local

Se revisaron los nueve archivos, referencias, `THROW` inicial de los scripts de escritura, barrera de identidad del precheck, estado Git y `git diff --check`. Los archivos untracked se comprobaron además contra espacios finales y credenciales. No hubo cambios en API-Clinica, WebClinica, Azure SQL, roles, permisos ni migraciones. No se desplegó ni se inició WEB-TRAT-06B-2.

**Situación al cierre de WEB-TRAT-06B-1:** se requería autorización nueva para crear `ClinicaTratamiento_Aislado_06B`; dicha autorización llegó después y su ejecución exclusiva se registra abajo. La autorización de esquema base sintético, siete tablas y pruebas DML sigue pendiente. El DBA debe confirmar identidad/privilegios y revisar una futura copia ejecutable. Ninguna barrera `THROW` se ha retirado.

## Actualización WEB-TRAT-06B-3 — 22/10/2026

La autorización posterior permitió **únicamente crear la base vacía**. Tras verificar por SELECT máquina `DESKTOP-QTDJOHF`, instancia `SQLEXPRESS`, edición Express (`EngineEdition=4`), identidad Windows y ausencia del nombre exacto, Codex ejecutó desde `master` `CREATE DATABASE [ClinicaTratamiento_Aislado_06B];`. La base quedó `ONLINE`; la lectura posterior mostró **0 tablas de usuario y 0 objetos de aplicación**. Los únicos principales observados fueron `dbo`, `guest`, `INFORMATION_SCHEMA` y `sys` (del sistema). Detalle verificable en [`CREACION-BASE-AISLADA.md`](CREACION-BASE-AISLADA.md).

Esta actualización sustituye **solo** la afirmación histórica anterior de que la base no existía: ahora existe vacía. El alcance de preparación WEB-TRAT-06B-1 y las pruebas estructurales siguen pendientes. No se ejecutó ninguno de los scripts preparados ni se cambiaron API, WebClinica, Azure SQL, usuarios o permisos. La identidad de prueba restringida y toda creación de tablas requieren nueva autorización. `WEB-TRAT-01` continúa bloqueado.
