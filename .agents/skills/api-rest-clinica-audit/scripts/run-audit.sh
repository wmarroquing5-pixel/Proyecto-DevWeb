#!/usr/bin/env bash
set -euo pipefail

echo "== API Clínica/Farmacia: comprobaciones base =="
dotnet --info

sln="$(find . -name '*.sln' -print -quit)"
if [[ -n "${sln}" ]]; then
  target="${sln}"
else
  target="$(find . -name '*.csproj' -print -quit)"
fi

if [[ -z "${target}" ]]; then
  echo "No se encontró .sln ni .csproj" >&2
  exit 1
fi

echo "Target: ${target}"
dotnet restore "${target}"
dotnet build "${target}" --configuration Release --no-restore

mapfile -t tests < <(find . -name '*Test*.csproj' -o -name '*Tests*.csproj')
if [[ ${#tests[@]} -gt 0 ]]; then
  for tp in "${tests[@]}"; do
    echo "Ejecutando pruebas: ${tp}"
    dotnet test "${tp}" --configuration Release --no-build
  done
else
  echo "ADVERTENCIA: no se detectaron proyectos de pruebas automatizadas."
fi

if find . -name Dockerfile -print -quit | grep -q .; then
  echo "Dockerfile detectado."
else
  echo "ADVERTENCIA: no se encontró Dockerfile."
fi

echo "Comprobaciones base finalizadas. Continúe con references/test-catalog.md."
