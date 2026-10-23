---
name: database-contract
description: >
  Utilizar cuando una tarea involucre Entity Framework Core,
  DbContext, entidades, relaciones, repositorios, persistencia
  o consultas relacionadas con la base de datos de Clínica y Farmacia.
---

# Database Contract

La base de datos SQL Server/Azure SQL existente es el contrato definitivo.

Nunca modificar su estructura.

## Ubicación de informes y documentación generada

Todos los informes, auditorías, diagnósticos técnicos, matrices, evidencias de validación, resultados de pruebas y resúmenes de implementación deben guardarse fuera de los proyectos, en:

- API-Clinica: `C:\Users\DESARROLLO\Documents\ChatGPT\Documentacion\API-Clinica`
- WebClinica: `C:\Users\DESARROLLO\Documents\ChatGPT\Documentacion\WebClinica`
- Informes de ambos proyectos: `C:\Users\DESARROLLO\Documents\ChatGPT\Documentacion\Compartido`

Crea la carpeta correspondiente si no existe. Usa nombres descriptivos con fecha e identificador de tarea, cuando exista.

No guardes estos documentos en la raíz de los repositorios ni en sus carpetas de código, pruebas o compilación.

Esta regla se aplica a los documentos generados para entregar o registrar resultados. El código, las pruebas automatizadas, la configuración, los archivos operativos y las propias skills deben conservar su ubicación.

Si no puedes acceder a la ruta indicada, informa el impedimento. No guardes el informe dentro del proyecto como alternativa ni afirmes que fue guardado.

## Prohibido

- CREATE TABLE
- ALTER TABLE
- DROP TABLE
- agregar columnas
- eliminar columnas
- cambiar tipos
- cambiar PK
- cambiar FK
- cambiar constraints
- cambiar índices
- crear triggers
- crear migraciones EF que alteren la BD
- Database.Migrate()
- Database.EnsureCreated()

## Entity Framework Core

Entity Framework debe adaptarse al esquema existente.

Antes de crear o modificar una entidad:

1. comprobar tabla;
2. comprobar columnas;
3. comprobar tipos;
4. comprobar nulabilidad;
5. comprobar PK;
6. comprobar FK;
7. comprobar relaciones;
8. comprobar restricciones existentes.

Nunca inventar propiedades persistentes que no tengan columna correspondiente.

## Validaciones

Las reglas adicionales deben implementarse mediante:

- DTO;
- servicios;
- validadores;
- autorización;
- lógica de aplicación.

No modificar la BD para resolver una regla de negocio.

## Relaciones

Respetar exactamente las relaciones actuales.

No agregar relaciones nuevas solamente para simplificar código.

## Si falta estructura

Si una funcionalidad parece necesitar una tabla o columna inexistente:

1. no modificar la BD;
2. analizar si puede resolverse en la API;
3. implementar la alternativa más segura;
4. informar claramente la limitación si no puede resolverse correctamente.

## Finalización

Después de cambios relacionados con persistencia ejecutar:

dotnet restore
dotnet build

Comprobar que:

- no aparecieron migraciones nuevas;
- no se generaron scripts ALTER;
- no se modificó el esquema SQL.