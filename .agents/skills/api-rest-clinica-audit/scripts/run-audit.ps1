$ErrorActionPreference = "Stop"

Write-Host "== API Clínica/Farmacia: comprobaciones base =="
dotnet --info

$sln = Get-ChildItem -Recurse -Filter *.sln | Select-Object -First 1
if ($null -eq $sln) {
    Write-Warning "No se encontró .sln. Buscando .csproj..."
    $project = Get-ChildItem -Recurse -Filter *.csproj | Select-Object -First 1
    if ($null -eq $project) { throw "No se encontró proyecto .NET." }
    $target = $project.FullName
} else {
    $target = $sln.FullName
}

Write-Host "Target: $target"
dotnet restore $target
dotnet build $target --configuration Release --no-restore

$testProjects = Get-ChildItem -Recurse -Filter *.csproj | Where-Object { $_.Name -match 'Test|Tests' }
if ($testProjects.Count -gt 0) {
    foreach ($tp in $testProjects) {
        Write-Host "Ejecutando pruebas: $($tp.FullName)"
        dotnet test $tp.FullName --configuration Release --no-build
    }
} else {
    Write-Warning "No se detectaron proyectos de pruebas automatizadas."
}

$dockerfile = Get-ChildItem -Recurse -Filter Dockerfile | Select-Object -First 1
if ($null -ne $dockerfile) {
    Write-Host "Dockerfile detectado: $($dockerfile.FullName)"
} else {
    Write-Warning "No se encontró Dockerfile."
}

Write-Host "Comprobaciones base finalizadas. Continúe con references/test-catalog.md."
