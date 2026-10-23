using System.Security.Claims;
using System.Text.Json;
using API_Clinica.DTOs;
using API_Clinica.Data;
using API_Clinica.Exceptions;
using API_Clinica.Models.Entities;
using API_Clinica.Services;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Tests;

public sealed class RecetaClinicaPreparadorTests
{
    private readonly RecetaClinicaPreparador preparador = new();

    [Fact]
    public void MapeoSqlServerDeRecetaEsCompatibleSinConectarseALaBase()
    {
        var options = new DbContextOptionsBuilder<ClinicaDbContext>()
            .UseSqlServer("Server=(local);Database=NotUsed;Trusted_Connection=True;TrustServerCertificate=True")
            .Options;
        using var db = new ClinicaDbContext(options);
        var receta = db.Model.FindEntityType(typeof(RecetaClinica))!;
        var linea = db.Model.FindEntityType(typeof(RecetaLinea))!;
        Assert.Equal("dbo", receta.GetSchema());
        Assert.Equal("RecetaClinica", receta.GetTableName());
        Assert.Equal("RecetaLinea", linea.GetTableName());
        Assert.Equal("binary(32)", receta.FindProperty(nameof(RecetaClinica.HashSolicitud))!.GetColumnType());
        Assert.Equal("decimal(12,3)", linea.FindProperty(nameof(RecetaLinea.Dosis))!.GetColumnType());
        Assert.True(linea.FindProperty(nameof(RecetaLinea.ContenidoPorUnidad))!.IsNullable);
        Assert.True(linea.FindProperty(nameof(RecetaLinea.IdUsuarioValidador))!.IsNullable);
        Assert.Equal(3, linea.GetForeignKeys().Count());
        Assert.Contains("[RecetaClinica]", db.RecetasClinicas.ToQueryString());
        Assert.Contains("[RecetaLinea]", db.RecetaLineas.ToQueryString());
    }

    [Fact]
    public void PreparaRecetaConVariosMedicamentosSinLoteNiInventario()
    {
        var request = Request(Line(10), Line(11));
        var result = preparador.Preparar(request, Principal(), Context());

        Assert.Equal(1, result.IdConsulta);
        Assert.Equal(9, result.IdDiagnostico);
        Assert.Equal("Reposo e hidratación", result.DescripcionTratamiento);
        Assert.Equal(3, result.IdUsuarioPrescriptor);
        Assert.Equal("Vigente", result.EstadoInicialReceta);
        Assert.Equal(new[] { (short)1, (short)2 }, result.Lineas.Select(l => l.Orden));
        Assert.Equal(new[] { 10, 11 }, result.Lineas.Select(l => l.IdMedicamento));
        Assert.All(result.Lineas, l => Assert.Equal("tableta", l.UnidadInventario));
        Assert.All(result.Lineas, l => Assert.Equal((short)5, l.DuracionDias));
        Assert.All(result.Lineas, l => Assert.Equal("Clinica", l.DestinoMedicamento));
        Assert.Equal(32, result.HashSolicitud.Length);
        Assert.DoesNotContain(typeof(CrearRecetaClinicaRequest).GetProperties(),
            p => p.Name is "IdLote" or "Estado" or "IdUsuarioPrescriptor" or "FechaPrescripcionUtc");
        Assert.DoesNotContain(typeof(RecetaLineaCrearRequest).GetProperties(),
            p => p.Name is "IdLote" or "CantidadDisponible");
    }

    [Fact]
    public void RechazaDiagnosticoDeOtraConsulta()
    {
        var context = Context() with
        {
            Diagnostico = new Diagnostico { IdDiagnostico = 9, IdConsulta = 2 }
        };
        Assert.Throws<NotFoundException>(() =>
            preparador.Preparar(Request(Line(10)), Principal(), context));
    }

    [Fact]
    public void RechazaFechaFinalAnteriorAlInicio()
    {
        var request = new CrearRecetaClinicaRequest
        {
            IdConsulta = 1, IdDiagnostico = 9,
            ClaveOperacion = Guid.Parse("1d78bd51-5166-4b78-89cd-15ad6e42eac7"),
            DescripcionTratamiento = "Reposo", FechaInicio = new DateOnly(2026, 10, 23),
            FechaFin = new DateOnly(2026, 10, 22), Lineas = [Line(10)]
        };
        Assert.Throws<AppValidationException>(() =>
            preparador.Preparar(request, Principal(), Context()));
    }

    [Fact]
    public void RechazaRecetaSinMedicamentos()
    {
        var error = Assert.Throws<AppValidationException>(() =>
            preparador.Preparar(Request(), Principal(), Context()));
        Assert.Contains("Lineas", error.Errors.Keys);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void RechazaCantidadNoPositiva(int cantidad)
    {
        Assert.Throws<AppValidationException>(() =>
            preparador.Preparar(Request(Line(10, cantidad)), Principal(), Context()));
    }

    [Fact]
    public void CalculaDuracionInclusivaYRechazaIntervaloInvalido()
    {
        Assert.Equal((short)1, RecetaClinicaPreparador.CalcularDuracionDias(
            new DateOnly(2026, 10, 23), new DateOnly(2026, 10, 23)));
        Assert.Equal((short)8, RecetaClinicaPreparador.CalcularDuracionDias(
            new DateOnly(2026, 10, 23), new DateOnly(2026, 10, 30)));
        Assert.Throws<AppValidationException>(() =>
            RecetaClinicaPreparador.CalcularDuracionDias(new DateOnly(2026, 10, 23), new DateOnly(2026, 10, 22)));
    }

    [Fact]
    public void RechazaUsuarioSinPermisoOSinAutenticacion()
    {
        var context = Context() with { TienePermisoPrescribir = false };
        Assert.Throws<ForbiddenException>(() =>
            preparador.Preparar(Request(Line(10)), Principal(), context));
        Assert.Throws<ForbiddenException>(() =>
            preparador.Preparar(Request(Line(10)), new ClaimsPrincipal(), Context()));
    }

    [Fact]
    public void RechazaMedicoAjenoOInactivo()
    {
        var ajeno = Context() with { Usuario = new Usuario
        {
            IdUsuario = 3, IdRol = 2, IdEmpleado = 8,
            Username = "doctor.test", Activo = true
        } };
        Assert.Throws<ForbiddenException>(() =>
            preparador.Preparar(Request(Line(10)), Principal(), ajeno));
        var inactivo = Context() with { Medico = new Empleado
        {
            IdEmpleado = 7, TipoEmpleado = "Medico", Activo = false
        } };
        Assert.Throws<ForbiddenException>(() =>
            preparador.Preparar(Request(Line(10)), Principal(), inactivo));
    }

    [Fact]
    public void RechazaMedicamentoInexistenteOInactivo()
    {
        Assert.Throws<NotFoundException>(() =>
            preparador.Preparar(Request(Line(99)), Principal(), Context()));
        var context = Context() with { Medicamentos = new Dictionary<int, Medicamento>
        {
            [10] = new() { IdMedicamento = 10, Activo = false }
        } };
        Assert.Throws<ConflictException>(() =>
            preparador.Preparar(Request(Line(10)), Principal(), context));
    }

    [Fact]
    public void AceptaUnidadDeEntregaDirectaSinConversion()
    {
        var policy = Policy() with
        {
            Equivalencias = new Dictionary<int, EquivalenciaFarmaceuticaAprobada>()
        };
        var result = preparador.Preparar(Request(Line(10, unidadInventario: "ml")), Principal(),
            Context() with { Politica = policy });
        Assert.Equal("ml", result.Lineas[0].UnidadInventario);
        Assert.Equal("Clinica", result.Lineas[0].DestinoMedicamento);
    }

    [Fact]
    public void RechazaUnidadDeEntregaVacia()
    {
        var linea = Line(10, unidadInventario: "  ");
        var error = Assert.Throws<AppValidationException>(() =>
            preparador.Preparar(Request(linea), Principal(), Context()));
        Assert.Contains("UnidadInventario", error.Errors.Keys);
    }

    [Fact]
    public void RechazaCantidadNumericaComoUnidadDeEntrega()
    {
        var error = Assert.Throws<AppValidationException>(() =>
            preparador.Preparar(Request(Line(10, cantidad: 10, unidadInventario: "10")),
                Principal(), Context()));
        Assert.Contains("UnidadInventario", error.Errors.Keys);
    }

    [Theory]
    [InlineData("Clinica")]
    [InlineData("CompraExterna")]
    public void JsonWebAceptaDestinoTextualYPreparadorLoConserva(string destino)
    {
        var json = JsonSerializer.Serialize(Request(Line(10, destino: destino)),
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var request = JsonSerializer.Deserialize<CrearRecetaClinicaRequest>(json,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.NotNull(request);
        var result = preparador.Preparar(request, Principal(), Context());
        Assert.Equal(destino, result.Lineas[0].DestinoMedicamento);
        Assert.Equal(10, result.Lineas[0].IdMedicamento);
    }

    [Fact]
    public void JsonWebRechazaDestinoNumericoAntesDePreparar()
    {
        const string json = "{\"idConsulta\":1,\"lineas\":[{\"destinoMedicamento\":10}]}";
        var error = Assert.Throws<JsonException>(() =>
            JsonSerializer.Deserialize<CrearRecetaClinicaRequest>(json,
                new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        Assert.Contains("destinoMedicamento", error.Path ?? string.Empty);
    }

    [Fact]
    public void RechazaUnidadDeEntregaQueExcedeLaColumna()
    {
        var error = Assert.Throws<AppValidationException>(() =>
            preparador.Preparar(Request(Line(10, unidadInventario: new string('x', 31))),
                Principal(), Context()));
        Assert.Contains("UnidadInventario", error.Errors.Keys);
    }

    [Fact]
    public void RechazaDestinoNoAprobadoYFechaFinalAusente()
    {
        var error = Assert.Throws<AppValidationException>(() =>
            preparador.Preparar(Request(Line(10, destino: "Otro")), Principal(), Context()));
        Assert.Contains("DestinoMedicamento", error.Errors.Keys);
        var sinFin = new CrearRecetaClinicaRequest
        {
            IdConsulta = 1, IdDiagnostico = 9, ClaveOperacion = Guid.NewGuid(),
            DescripcionTratamiento = "Tratamiento sintético",
            FechaInicio = new DateOnly(2026, 10, 23), Lineas = [Line(10)]
        };
        error = Assert.Throws<AppValidationException>(() =>
            preparador.Preparar(sinFin, Principal(), Context()));
        Assert.Contains("FechaFin", error.Errors.Keys);
    }

    [Fact]
    public void BloqueaEstadoNuloOPoliticaClinicaAusente()
    {
        Assert.Throws<ConflictException>(() =>
            preparador.Preparar(Request(Line(10)), Principal(), Context() with { Politica = null }));
        var context = Context() with { Consulta = new Consulta
        {
            IdConsulta = 1, IdMedico = 7, EstadoConsulta = null
        } };
        Assert.Throws<ConflictException>(() =>
            preparador.Preparar(Request(Line(10)), Principal(), context));
        var cerrada = Context() with { Consulta = new Consulta
        {
            IdConsulta = 1, IdMedico = 7, EstadoConsulta = "Cerrada"
        } };
        Assert.Throws<ConflictException>(() =>
            preparador.Preparar(Request(Line(10)), Principal(), cerrada));
    }

    [Fact]
    public void AdmiteConsultaAbiertaSegunPoliticaAprobada()
    {
        var context = Context() with { Consulta = new Consulta
        {
            IdConsulta = 1, IdMedico = 7, EstadoConsulta = "Abierta"
        } };
        var result = preparador.Preparar(Request(Line(10)), Principal(), context);
        Assert.Equal("Vigente", result.EstadoInicialReceta);
    }

    [Fact]
    public void BloqueaMedicamentoDuplicadoSinReglaAprobada()
    {
        var request = Request(Line(10), Line(10));
        Assert.Throws<ConflictException>(() =>
            preparador.Preparar(request, Principal(), Context()));
        var policy = Policy() with { PermiteMismoMedicamentoEnVariasLineas = false };
        Assert.Throws<AppValidationException>(() =>
            preparador.Preparar(request, Principal(), Context() with { Politica = policy }));
    }

    [Fact]
    public void HuellaEsEstableParaElMismoCuerpoYDetectaCambioDeCantidadYDestino()
    {
        var first = preparador.Preparar(Request(Line(10, 1)), Principal(), Context());
        var same = preparador.Preparar(Request(Line(10, 1)), Principal(), Context());
        var changed = preparador.Preparar(Request(Line(10, 2)), Principal(), Context());
        var updatedPolicy = Policy() with
        {
            Equivalencias = new Dictionary<int, EquivalenciaFarmaceuticaAprobada>
            {
                [10] = Equivalence() with { Version = "v2" }
            }
        };
        var sameRequestAfterPolicyChange = preparador.Preparar(
            Request(Line(10, 1)), Principal(), Context() with { Politica = updatedPolicy });
        Assert.Equal(first.HashSolicitud.ToArray(), same.HashSolicitud.ToArray());
        Assert.Equal(first.HashSolicitud.ToArray(),
            sameRequestAfterPolicyChange.HashSolicitud.ToArray());
        Assert.NotEqual(first.HashSolicitud.ToArray(), changed.HashSolicitud.ToArray());
        var changedUnit = preparador.Preparar(Request(Line(10, 1, unidadInventario: "frasco")),
            Principal(), Context());
        Assert.NotEqual(first.HashSolicitud.ToArray(), changedUnit.HashSolicitud.ToArray());
        var changedDestination = preparador.Preparar(Request(Line(10, 1, destino: "CompraExterna")), Principal(), Context());
        Assert.NotEqual(first.HashSolicitud.ToArray(), changedDestination.HashSolicitud.ToArray());
    }

    [Theory]
    [InlineData("IdLote")]
    [InlineData("IdTratamiento")]
    [InlineData("Estado")]
    [InlineData("IdUsuarioPrescriptor")]
    [InlineData("ContenidoPorUnidad")]
    [InlineData("FuenteEquivalencia")]
    public void ContratoRechazaCamposAdministrativosODeInventario(string field)
    {
        var json = "{\"IdConsulta\":1,\"IdDiagnostico\":9," +
            "\"ClaveOperacion\":\"1d78bd51-5166-4b78-89cd-15ad6e42eac7\"," +
            $"\"{field}\":1}}";
        Assert.Throws<JsonException>(() =>
            JsonSerializer.Deserialize<CrearRecetaClinicaRequest>(json));
    }

    private static CrearRecetaClinicaRequest Request(params RecetaLineaCrearRequest[] lines) => new()
    {
        IdConsulta = 1, IdDiagnostico = 9,
        ClaveOperacion = Guid.Parse("1d78bd51-5166-4b78-89cd-15ad6e42eac7"),
        DescripcionTratamiento = "Reposo e hidratación",
        FechaInicio = new DateOnly(2026, 10, 23),
        FechaFin = new DateOnly(2026, 10, 27),
        Lineas = lines
    };

    private static RecetaLineaCrearRequest Line(
        int medicamento, int cantidad = 5,
        string unidadInventario = "tableta", string destino = "Clinica") => new()
    {
        IdMedicamento = medicamento, UnidadInventario = unidadInventario,
        DestinoMedicamento = destino, CantidadPrescritaUnidades = cantidad
    };

    private static ClaimsPrincipal Principal() => new(new ClaimsIdentity(
    [
        new Claim("IdUsuario", "3"),
        new Claim("IdRol", "2"),
        new Claim("Username", "doctor.test")
    ], "Prueba"));

    private static RecetaClinicaContextoConfiable Context() => new(
        new Consulta { IdConsulta = 1, IdMedico = 7, EstadoConsulta = "En seguimiento" },
        new Diagnostico { IdDiagnostico = 9, IdConsulta = 1 },
        new Usuario
        {
            IdUsuario = 3, IdRol = 2, IdEmpleado = 7,
            Username = "doctor.test", Activo = true
        },
        new Empleado { IdEmpleado = 7, Activo = true, TipoEmpleado = "Medico" },
        true,
        new Dictionary<int, Medicamento>
        {
            [10] = new() { IdMedicamento = 10, Activo = true },
            [11] = new() { IdMedicamento = 11, Activo = true }
        },
        Policy());

    // Política exclusivamente sintética de la prueba; no se registra en DI.
    private static PoliticaPrescripcionAprobada Policy() => new(
        new HashSet<string>(StringComparer.Ordinal) { "Abierta", "En seguimiento" },
        "Vigente", null,
        new Dictionary<int, EquivalenciaFarmaceuticaAprobada>
        {
            [10] = Equivalence(),
            [11] = Equivalence()
        });

    private static EquivalenciaFarmaceuticaAprobada Equivalence() => new(
        "tableta", "mg", 500m, "mg", "Ficha sintética aprobada para prueba",
        "v1", 6, new DateTime(2026, 10, 23, 0, 0, 0, DateTimeKind.Utc));
}
