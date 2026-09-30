# api-rest-clinica-audit

Skill para Codex/agents destinada a auditar y probar la API REST .NET 10 del proyecto Clínica/Farmacia 2026.

## Estructura

- `SKILL.md`: instrucciones principales.
- `references/project-requirements.md`: requisitos normalizados y trazables.
- `references/test-catalog.md`: catálogo mínimo de pruebas.
- `assets/audit-report-template.md`: plantilla de informe.
- `assets/evidence-matrix.csv`: matriz para capturar evidencias.
- `scripts/run-audit.ps1`: comprobaciones base en Windows/PowerShell.
- `scripts/run-audit.sh`: comprobaciones base en Linux/macOS.

## Uso sugerido en Codex

Coloque la carpeta completa en el directorio de skills/capabilities que utilice su entorno de Codex y solicite explícitamente:

`Usa la skill api-rest-clinica-audit para auditar este proyecto. Ejecuta el catálogo completo y genera el informe con evidencias.`

No coloque credenciales reales dentro de la skill.
