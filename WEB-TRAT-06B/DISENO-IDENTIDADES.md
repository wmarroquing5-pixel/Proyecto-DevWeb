# WEB-TRAT-06B-4 — Diseño de identidades (propuesta, sin ejecutar)

La base `ClinicaTratamiento_Aislado_06B` ya existe vacía en `DESKTOP-QTDJOHF\SQLEXPRESS` según `CREACION-BASE-AISLADA.md`. Este documento **no aprueba** cuentas, permisos, tablas ni pruebas. No se abrió conexión SQL en WEB-TRAT-06B-4. `WEB-TRAT-01` sigue bloqueado.

## Separación de funciones

| Función propuesta | Identidad Windows propuesta | Alcance futuro mínimo | Exclusiones |
|---|---|---|---|
| Operador de aprovisionamiento | Grupo local `DESKTOP-QTDJOHF\ClinicaTrat06B_Provision` | Conectar a la base aislada; `VIEW DEFINITION`, `CREATE TABLE` en esa base y `ALTER` sobre `dbo` durante una ventana aprobada. | Sin `sysadmin`, `db_owner`, `db_ddladmin`, `ALTER ANY DATABASE`, escritura en otras bases ni uso cotidiano por la API. |
| Ejecutor de pruebas | Grupo local `DESKTOP-QTDJOHF\ClinicaTrat06B_Pruebas` | Conectar solo a la base aislada; tras crear objetos, DML y SELECT **por objeto y operación** estrictamente necesarios para casos sintéticos aprobados. | Sin DDL, permisos de servidor, acceso a `db_Clinica` o Azure SQL; no heredar permisos clínicos. |

Los nombres son **propuestas**, no grupos verificados ni autorizados. El administrador local tendría que crear los grupos y asignar personas/cuentas de prueba separadas mediante un procedimiento futuro. No se crean aquí. El login Windows `DESKTOP-QTDJOHF\DESARROLLO` observado en 06B-3 es `sysadmin`; no debe ser la identidad de pruebas. Si el operador administrativo lo usa para el alta inicial de logins, la ventana debe ser supervisada y registrada. Con `dbo` compartido, `ALTER ON SCHEMA::dbo` permite alterar cualquier objeto de ese esquema **dentro de la base aislada**, no únicamente las catorce tablas propuestas; por ello se concede solo temporalmente y se revoca tras el aprovisionamiento. No afirmar que una concesión de esquema limite por nombre cada tabla.

Se prefiere autenticación Windows integrada: evita contraseñas en los scripts y permite separar grupos locales. SQL Server Authentication sería alternativa únicamente si Windows no resulta viable; exigiría secreto externo gestionado por el administrador, política de rotación y `CHECK_POLICY`, sin escribir la contraseña en este repositorio. `IDENTIDADES-PROPUESTAS.sql` usa solo la opción Windows y mantiene un `THROW` inicial. No ejecutar el borrador directamente.

## Puerta de seguridad futura

1. Aprobar por escrito operador, miembros de ambos grupos, servidor, base, objetos y ventana. Comprobar que ningún grupo tenga `sysadmin`, otros roles de servidor, membresía heredada amplia o acceso por `public`/`guest` a bases no previstas. El nombre de login por sí solo **no garantiza** exclusividad de base.
2. Verificar mediante conexión local `lpc:.\SQLEXPRESS`, sin `DefaultConnection`, las propiedades del motor, nombre de base, identidad y catálogo. Detenerse si hay objetos inesperados. No usar `aud_empresa`.
3. Crear las identidades solo tras autorización nueva. La de pruebas no recibe DML hasta que existan tablas y se apruebe una lista de `GRANT` por objeto. No conceder `db_datareader`, `db_datawriter` o `db_ddladmin` por conveniencia.
4. Tras aprovisionar, revocar `CREATE TABLE` y `ALTER ON SCHEMA::dbo` a la identidad de aprovisionamiento y confirmar permisos efectivos. Separar los futuros scripts/operaciones de creación, concesión, pruebas y retirada de privilegios; cada etapa exige autorización propia.
5. Confirmar acceso denegado a `db_Clinica` y bases no previstas y que ninguna identidad puede conectarse a Azure SQL. Esa comprobación todavía no se ha efectuado.

La API usa permisos clínicos dinámicos en `dbo.Permiso`. Estos grupos SQL son **solo** para el laboratorio; no modifican JWT, RBAC ni las 67 asignaciones existentes.
