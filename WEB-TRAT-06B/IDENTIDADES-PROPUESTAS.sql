/* WEB-TRAT-06B-4 — BORRADOR NO EJECUTABLE. Primera instrucción: barrera.
   No crear grupos Windows con este archivo; sus nombres son propuestas.
   Una copia nueva, revisada y autorizada, deberá separar alta de logins,
   usuarios, concesiones y revocación. Nunca ejecutar contra Azure SQL. */
THROW 51060, N'Identidades propuestas: ejecución no autorizada.', 1;

/* REFERENCIA PARA DBA, NO INSTRUCCIONES APROBADAS.
   Paso de servidor: conexión administrativa local, contexto master.
   La comprobación posterior al THROW sigue fallando con marcador sin aprobar. */
DECLARE @OperadorAprobado sysname = N'__OPERADOR_PENDIENTE__';
IF COALESCE(CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')), N'') <> N'DESKTOP-QTDJOHF'
   OR COALESCE(CONVERT(nvarchar(128), SERVERPROPERTY('InstanceName')), N'') <> N'SQLEXPRESS'
   OR COALESCE(CONVERT(int, SERVERPROPERTY('EngineEdition')), -1) <> 4
   OR DB_NAME() <> N'master'
   OR @OperadorAprobado = N'__OPERADOR_PENDIENTE__'
   OR ORIGINAL_LOGIN() <> @OperadorAprobado
   OR DB_ID(N'ClinicaTratamiento_Aislado_06B') IS NULL
   OR EXISTS (SELECT 1 FROM sys.server_principals WHERE name IN
       (N'DESKTOP-QTDJOHF\ClinicaTrat06B_Provision', N'DESKTOP-QTDJOHF\ClinicaTrat06B_Pruebas'))
    THROW 51061, N'Precheck de servidor o identidades no aprobado.', 1;

/* No ejecutar este bloque sin verificar antes que ambos grupos Windows
   existen, que no tienen membresía privilegiada y que el acceso a otras
   bases está denegado por la configuración efectiva del servidor. */
CREATE LOGIN [DESKTOP-QTDJOHF\ClinicaTrat06B_Provision] FROM WINDOWS;
CREATE LOGIN [DESKTOP-QTDJOHF\ClinicaTrat06B_Pruebas] FROM WINDOWS;

/* Cambio explícito a la única base aislada. No hay GO: la barrera inicial
   cubre el archivo completo si se envía como un lote. */
USE [ClinicaTratamiento_Aislado_06B];
IF DB_NAME() <> N'ClinicaTratamiento_Aislado_06B'
   OR COALESCE(CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')), N'') <> N'DESKTOP-QTDJOHF'
   OR COALESCE(CONVERT(nvarchar(128), SERVERPROPERTY('InstanceName')), N'') <> N'SQLEXPRESS'
   OR COALESCE(CONVERT(int, SERVERPROPERTY('EngineEdition')), -1) <> 4
   OR ORIGINAL_LOGIN() <> @OperadorAprobado
   OR EXISTS (SELECT 1 FROM sys.tables WHERE is_ms_shipped = 0)
    THROW 51062, N'La base aislada no está vacía o la identidad cambió.', 1;

CREATE USER [ClinicaTrat06B_Provision] FOR LOGIN [DESKTOP-QTDJOHF\ClinicaTrat06B_Provision];
CREATE USER [ClinicaTrat06B_Pruebas] FOR LOGIN [DESKTOP-QTDJOHF\ClinicaTrat06B_Pruebas];
GRANT CONNECT TO [ClinicaTrat06B_Provision];
GRANT CONNECT TO [ClinicaTrat06B_Pruebas];
GRANT CREATE TABLE TO [ClinicaTrat06B_Provision];
GRANT VIEW DEFINITION TO [ClinicaTrat06B_Provision];
GRANT ALTER ON SCHEMA::dbo TO [ClinicaTrat06B_Provision];

/* DML de pruebas: PENDIENTE de tablas y autorización de casos; deliberadamente
   sin GRANT aquí. Los permisos DDL del aprovisionador deberán revocarse tras
   crear solo los objetos aprobados. Este archivo no concede roles de base. */
