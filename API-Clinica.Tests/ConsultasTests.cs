using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Models.Entities;
using API_Clinica.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace API_Clinica.Tests;

public sealed class ConsultasTests
{
    private static readonly DateTime Fecha = new(2026, 1, 15, 10, 30, 0, DateTimeKind.Utc);

    [Fact]
    public async Task CreaConsultaConClinicaYRegistraEvaluacionPorRutaEspecifica()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PostAsJsonAsync("/api/consultas", new
        {
            idConsulta = 999, idPaciente = 1, idMedico = 1, idSucursal = 1,
            idClinica = 1, fechaConsulta = Fecha, motivoConsulta = "  Revisión   general "
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var consulta = await response.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.NotNull(consulta);
        Assert.NotEqual(999, consulta.IdConsulta);
        Assert.Equal(1, consulta.IdClinica);
        Assert.Equal(1, consulta.IdMedico);
        Assert.Equal("Revisión general", consulta.MotivoConsulta);
        Assert.Equal("Abierta", consulta.EstadoConsulta);
        Assert.Null(consulta.PesoLb);
        var evaluacion = await client.PostAsJsonAsync(
            $"/api/consultas/{consulta.IdConsulta}/evaluacion", new
            {
                sintomas = " Dolor  leve ", observaciones = "  Control ",
                pesoLb = 150.5, presionDiastolica = 80.0,
                presionSistolica = 120.0, alturaCm = 170
            });
        Assert.Equal(HttpStatusCode.Created, evaluacion.StatusCode);
        var evaluada = await evaluacion.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.Equal("En seguimiento", evaluada?.EstadoConsulta);
        Assert.Equal("Dolor leve", evaluada?.Sintomas);
        Assert.Equal(150.5, evaluada?.PesoLb);
        Assert.Equal($"/api/consultas/{consulta.IdConsulta}",
            response.Headers.Location?.AbsolutePath);
        using var scope = factory.Services.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.SingleAsync();
        Assert.Equal(1, stored.IdClinica);
        Assert.Equal(170, stored.AlturaCm);
        Assert.Equal("En seguimiento", stored.EstadoConsulta);
    }

    [Fact]
    public async Task EvaluacionUnicaRechazaRepeticionYNoCambiaDatosAdministrativos()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var openedResponse = await client.PostAsJsonAsync("/api/consultas", new
        {
            idPaciente = 1, idMedico = 1, idSucursal = 1, fechaConsulta = Fecha,
            motivoConsulta = "Apertura"
        });
        var opened = await openedResponse.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.NotNull(opened);
        var url = $"/api/consultas/{opened.IdConsulta}/evaluacion";
        var first = await client.PostAsJsonAsync(url, new
        {
            sintomas = "Fiebre", temperaturaC = 37.2m,
            idPaciente = 2, idMedico = 2, idSucursal = 2,
            motivoConsulta = "Intento de cambio", estadoConsulta = "Cerrada"
        });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal($"/api/consultas/{opened.IdConsulta}",
            first.Headers.Location?.AbsolutePath);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync(url, new { sintomas = "Sobrescribir" })).StatusCode);
        await factory.LinkUserToMedicoAsync(1);
        var detail = await client.GetFromJsonAsync<ConsultaDetalleDto>(
            $"/api/consultas/{opened.IdConsulta}");
        Assert.NotNull(detail);
        Assert.Equal("Fiebre", detail.Sintomas);
        Assert.Equal(37.2m, detail.TemperaturaC);
        Assert.Equal("En seguimiento", detail.EstadoConsulta);
        Assert.Equal("Apertura", detail.MotivoConsulta);
        Assert.Equal(1, detail.IdPaciente);
        Assert.Equal(1, detail.IdMedico);
        Assert.Equal(1, detail.IdSucursal);
        Assert.Equal(Fecha, detail.FechaConsulta);
        var page = await client.GetFromJsonAsync<PagedResponse<ConsultaListadoDto>>(
            "/api/consultas");
        Assert.Equal("En seguimiento", Assert.Single(page!.Items).EstadoConsulta);
        using var scope = factory.Services.CreateScope();
        Assert.Single(await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task EvaluacionSoloAceptaAbiertaSinDatosPreviosNiSolicitudVacia()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        await factory.SeedConsultasAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Consultas.SingleAsync(c => c.IdConsulta == 1)).EstadoConsulta = "Abierta";
            (await db.Consultas.SingleAsync(c => c.IdConsulta == 1)).Sintomas = "Previo";
            (await db.Consultas.SingleAsync(c => c.IdConsulta == 3)).EstadoConsulta = "Cerrada";
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/consultas/1/evaluacion",
                new { sintomas = "Nuevo" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/consultas/2/evaluacion",
                new { sintomas = "Nuevo" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/consultas/3/evaluacion",
                new { sintomas = "Nuevo" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PostAsJsonAsync("/api/consultas/999/evaluacion",
                new { sintomas = "Nuevo" })).StatusCode);
        var opened = await client.PostAsJsonAsync("/api/consultas", Nueva());
        var detail = await opened.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.NotNull(detail);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync($"/api/consultas/{detail.IdConsulta}/evaluacion",
                new { sintomas = "   ", pesoLb = (double?)null })).StatusCode);
        using var verify = factory.Services.CreateScope();
        var rows = await verify.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.AsNoTracking().OrderBy(c => c.IdConsulta).ToListAsync();
        Assert.Equal("Previo", rows[0].Sintomas);
        Assert.Equal("Abierta", rows[0].EstadoConsulta);
        Assert.Null(rows[1].EstadoConsulta);
        Assert.Equal("Cerrada", rows[2].EstadoConsulta);
        Assert.Equal("Abierta", rows[3].EstadoConsulta);
    }

    [Fact]
    public async Task EvaluacionExigeJwtPermisoYMedicoPropietario()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedConsultasAsync();
        using var client = factory.CreateClient();
        var url = "/api/consultas/1/evaluacion";
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.PostAsJsonAsync(url, new { sintomas = "Prueba" })).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync(url, new { sintomas = "Prueba" })).StatusCode);
        await factory.GrantReadAsync();
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync(url, new { sintomas = "Prueba" })).StatusCode);
        await factory.GrantWriteAsync();
        await factory.ConfigureCurrentUserAsMedicoAsync(2);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Permisos.Add(new Permiso { IdRol = 2, Modulo = "Consultas",
                PuedeConsultar = true, PuedeModificar = true });
            (await db.Consultas.SingleAsync(c => c.IdConsulta == 1)).EstadoConsulta = "Abierta";
            (await db.Consultas.SingleAsync(c => c.IdConsulta == 3)).EstadoConsulta = "Abierta";
            await db.SaveChangesAsync();
        }
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PostAsJsonAsync(url, new { sintomas = "Ajena" })).StatusCode);
        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/consultas/3/evaluacion",
                new { sintomas = "Propia" })).StatusCode);
    }

    [Fact]
    public async Task DosRegistrosSimultaneosSoloConfirmanUno()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var opened = await client.PostAsJsonAsync("/api/consultas", Nueva());
        var detail = await opened.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.NotNull(detail);
        var url = $"/api/consultas/{detail.IdConsulta}/evaluacion";
        var results = await Task.WhenAll(
            client.PostAsJsonAsync(url, new { sintomas = "Primera" }),
            client.PostAsJsonAsync(url, new { sintomas = "Segunda" }));
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.Created);
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.Conflict);
        using var scope = factory.Services.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.AsNoTracking().SingleAsync();
        Assert.Equal("En seguimiento", stored.EstadoConsulta);
        Assert.Contains(stored.Sintomas, new[] { "Primera", "Segunda" });
    }

    [Fact]
    public async Task AltaYPutGeneralesNoPuedenRegistrarNiSobrescribirEvaluacion()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var body = CuerpoBase();
        body["sintomas"] = "Dato por ruta incorrecta";
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/consultas", body)).StatusCode);
        body.Remove("sintomas");
        var opened = await client.PostAsJsonAsync("/api/consultas", body);
        var detail = await opened.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.NotNull(detail);
        body["temperaturaC"] = 36.5m;
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync($"/api/consultas/{detail.IdConsulta}", body)).StatusCode);
        using var scope = factory.Services.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.AsNoTracking().SingleAsync();
        Assert.Equal("Abierta", stored.EstadoConsulta);
        Assert.Null(stored.Sintomas);
        Assert.Null(stored.TemperaturaC);
    }

    [Fact]
    public async Task FalloDePersistenciaNoCambiaEstadoNiGuardaEvaluacion()
    {
        using var factory = new ConsultaApiFactory(fallarEvaluacion: true);
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var opened = await client.PostAsJsonAsync("/api/consultas", Nueva());
        var detail = await opened.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.NotNull(detail);
        Assert.Equal(HttpStatusCode.InternalServerError,
            (await client.PostAsJsonAsync(
                $"/api/consultas/{detail.IdConsulta}/evaluacion",
                new { sintomas = "No persistir" })).StatusCode);
        using var scope = factory.Services.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.AsNoTracking().SingleAsync();
        Assert.Equal("Abierta", stored.EstadoConsulta);
        Assert.Null(stored.Sintomas);
    }

    [Fact]
    public void ConsultaProtegeEstadoCamposClinicosYAtribucionComoTokens()
    {
        using var factory = new ConsultaApiFactory();
        using var scope = factory.Services.CreateScope();
        var entity = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Model.FindEntityType(typeof(Consulta));
        Assert.NotNull(entity);
        foreach (var property in new[] { "EstadoConsulta", "IdPaciente", "IdMedico",
            "IdSucursal", "IdClinica", "FechaConsulta", "MotivoConsulta",
            "Sintomas", "Observaciones", "PesoLb", "AlturaCm", "PresionSistolica",
            "PresionDiastolica", "TemperaturaC", "FrecuenciaCardiaca" })
            Assert.True(entity.FindProperty(property)?.IsConcurrencyToken);
    }

    [Fact]
    public async Task DosLecturasPreviasNoPuedenConfirmarLaSegundaEvaluacion()
    {
        using var factory = new ConsultaApiFactory();
        await factory.SeedAsync();
        await factory.SeedConsultasAsync();
        using (var setup = factory.Services.CreateScope())
        {
            var db = setup.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Consultas.SingleAsync(c => c.IdConsulta == 1)).EstadoConsulta = "Abierta";
            await db.SaveChangesAsync();
        }
        using var firstScope = factory.Services.CreateScope();
        using var secondScope = factory.Services.CreateScope();
        var first = firstScope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var second = secondScope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var firstCopy = await first.Consultas.SingleAsync(c => c.IdConsulta == 1);
        var secondCopy = await second.Consultas.SingleAsync(c => c.IdConsulta == 1);
        firstCopy.Sintomas = "Primera";
        firstCopy.EstadoConsulta = "En seguimiento";
        secondCopy.Sintomas = "Segunda";
        secondCopy.EstadoConsulta = "En seguimiento";
        await first.SaveChangesAsync();
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(
            () => second.SaveChangesAsync());
        using var verify = factory.Services.CreateScope();
        var stored = await verify.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.AsNoTracking().SingleAsync(c => c.IdConsulta == 1);
        Assert.Equal("Primera", stored.Sintomas);
        Assert.Equal("En seguimiento", stored.EstadoConsulta);
    }

    [Fact]
    public async Task PermiteClinicaYOtrosCamposOpcionalesAusentes()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PostAsJsonAsync("/api/consultas", Nueva());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var consulta = await response.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.NotNull(consulta);
        Assert.Null(consulta.IdClinica);
        Assert.Null(consulta.MotivoConsulta);
        Assert.Null(consulta.PesoLb);
        Assert.Null(consulta.TemperaturaC);
        Assert.Null(consulta.FrecuenciaCardiaca);
        Assert.Equal("Abierta", consulta.EstadoConsulta);
    }

    [Fact]
    public async Task CreaYConsultaTemperaturaDecimalYFrecuenciaSinAmpliarElListado()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var body = CuerpoBase();
        var created = await client.PostAsJsonAsync("/api/consultas", body);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var opened = await created.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.NotNull(opened);
        var saved = await client.PostAsJsonAsync(
            $"/api/consultas/{opened.IdConsulta}/evaluacion",
            new { temperaturaC = 36.7m, frecuenciaCardiaca = (short)72 });
        Assert.Equal(HttpStatusCode.Created, saved.StatusCode);
        var result = await saved.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.NotNull(result);
        Assert.Equal(36.7m, result.TemperaturaC);
        Assert.Equal((short)72, result.FrecuenciaCardiaca);
        await factory.LinkUserToMedicoAsync(1);
        var detail = await client.GetFromJsonAsync<ConsultaDetalleDto>(
            $"/api/consultas/{result.IdConsulta}");
        Assert.Equal(result.TemperaturaC, detail?.TemperaturaC);
        Assert.Equal(result.FrecuenciaCardiaca, detail?.FrecuenciaCardiaca);
        using var listJson = JsonDocument.Parse(await client.GetStringAsync("/api/consultas"));
        var item = listJson.RootElement.GetProperty("items")[0];
        Assert.False(item.TryGetProperty("temperaturaC", out _));
        Assert.False(item.TryGetProperty("frecuenciaCardiaca", out _));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task PermiteEnviarSoloUnoDeLosSignosVitales(bool temperatura)
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var created = await client.PostAsJsonAsync("/api/consultas", CuerpoBase());
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var opened = await created.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.NotNull(opened);
        var body = new Dictionary<string, object?>();
        if (temperatura) body["temperaturaC"] = 37.0m;
        else body["frecuenciaCardiaca"] = (short)80;

        var saved = await client.PostAsJsonAsync(
            $"/api/consultas/{opened.IdConsulta}/evaluacion", body);
        Assert.Equal(HttpStatusCode.Created, saved.StatusCode);
        var detail = await saved.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.NotNull(detail);
        Assert.Equal(temperatura ? 37.0m : null, detail.TemperaturaC);
        Assert.Equal(temperatura ? null : (short)80, detail.FrecuenciaCardiaca);
    }

    [Fact]
    public async Task PutConservaEvaluacionYNoAdmiteSobrescribirla()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        await factory.SeedConsultasAsync();
        using (var seedScope = factory.Services.CreateScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var row = await db.Consultas.SingleAsync(c => c.IdConsulta == 1);
            row.TemperaturaC = 36.5m;
            row.FrecuenciaCardiaca = 68;
            row.EstadoConsulta = "Estado existente";
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var body = CuerpoBase();
        body["idClinica"] = 1;
        body["motivoConsulta"] = "Motivo";

        var omitted = await client.PutAsJsonAsync("/api/consultas/1", body);
        Assert.Equal(HttpStatusCode.OK, omitted.StatusCode);
        var unchanged = await omitted.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.Equal(36.5m, unchanged?.TemperaturaC);
        Assert.Equal((short)68, unchanged?.FrecuenciaCardiaca);
        body["temperaturaC"] = 37.1m;
        var changed = await client.PutAsJsonAsync("/api/consultas/1", body);
        Assert.Equal(HttpStatusCode.BadRequest, changed.StatusCode);
        body["temperaturaC"] = null;
        body["frecuenciaCardiaca"] = null;
        var cleared = await client.PutAsJsonAsync("/api/consultas/1", body);
        Assert.Equal(HttpStatusCode.OK, cleared.StatusCode);
        var result = await cleared.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.Equal(36.5m, result?.TemperaturaC);
        Assert.Equal((short)68, result?.FrecuenciaCardiaca);
        Assert.Equal("Estado existente", result?.EstadoConsulta);
        using var verifyScope = factory.Services.CreateScope();
        var stored = await verifyScope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.AsNoTracking().SingleAsync(c => c.IdConsulta == 1);
        Assert.Equal(36.5m, stored.TemperaturaC);
        Assert.Equal((short)68, stored.FrecuenciaCardiaca);
        Assert.Equal("Estado existente", stored.EstadoConsulta);
    }

    [Theory]
    [InlineData("temperaturaC", "36.55")]
    [InlineData("temperaturaC", "1000.0")]
    [InlineData("frecuenciaCardiaca", "-1")]
    [InlineData("frecuenciaCardiaca", "32768")]
    public async Task RechazaValoresQueNoCabenOExigenRedondeo(string campo, string valor)
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var created = await client.PostAsJsonAsync("/api/consultas", CuerpoBase());
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var opened = await created.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.NotNull(opened);
        var body = new Dictionary<string, object?>();
        using var json = JsonDocument.Parse(valor);
        body[campo] = json.RootElement.Clone();

        var response = await client.PostAsJsonAsync(
            $"/api/consultas/{opened.IdConsulta}/evaluacion", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.AsNoTracking().SingleAsync();
        Assert.Equal("Abierta", stored.EstadoConsulta);
        Assert.Null(stored.TemperaturaC);
        Assert.Null(stored.FrecuenciaCardiaca);
    }

    [Fact]
    public async Task RechazaSignosVitalesSinPermisoDeModificarYSinPersistirlos()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantReadAsync();
        await factory.SeedConsultasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var body = CuerpoBase();
        body["idClinica"] = 1;
        body["temperaturaC"] = 36.8m;
        body["frecuenciaCardiaca"] = (short)75;

        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync("/api/consultas/1", body)).StatusCode);
        using var scope = factory.Services.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.AsNoTracking().SingleAsync(c => c.IdConsulta == 1);
        Assert.Null(stored.TemperaturaC);
        Assert.Null(stored.FrecuenciaCardiaca);
    }

    [Fact]
    public async Task MedicoNoPuedeModificarSignosVitalesDeConsultaAjena()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.ConfigureCurrentUserAsMedicoAsync(1);
        await factory.GrantReadAsync(2);
        await factory.GrantWriteAsync();
        await factory.SeedConsultasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var body = CuerpoBase();
        body["idSucursal"] = 2;
        body["idMedico"] = 2;
        body["idClinica"] = 2;
        body["temperaturaC"] = 36.8m;
        body["frecuenciaCardiaca"] = (short)75;

        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync("/api/consultas/3", body)).StatusCode);
        using var scope = factory.Services.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.AsNoTracking().SingleAsync(c => c.IdConsulta == 3);
        Assert.Null(stored.TemperaturaC);
        Assert.Null(stored.FrecuenciaCardiaca);
    }

    [Theory]
    [InlineData(999)]
    [InlineData(0)]
    public async Task RechazaPacienteInexistente(int idPaciente)
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/consultas",
                Nueva(idPaciente: idPaciente))).StatusCode);
    }

    [Theory]
    [InlineData("paciente")]
    [InlineData("clinica")]
    [InlineData("sucursal")]
    public async Task RechazaRecursosClinicosInactivosAlCrearSinPersistir(string recurso)
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var body = CuerpoBase();
        if (recurso == "paciente") body["idPaciente"] = 3;
        if (recurso == "clinica") body["idClinica"] = 3;
        if (recurso == "sucursal") body["idSucursal"] = 3;

        var response = await client.PostAsJsonAsync("/api/consultas", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        Assert.Empty(await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.ToListAsync());
    }

    [Theory]
    [InlineData(999)]
    [InlineData(3)]
    [InlineData(4)]
    public async Task RechazaMedicoInexistenteInactivoONoMedico(int idMedico)
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/consultas",
                Nueva(idMedico: idMedico))).StatusCode);
        using var scope = factory.Services.CreateScope();
        Assert.Empty(await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.ToListAsync());
    }

    [Fact]
    public async Task RechazaSucursalInexistente()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/consultas",
                Nueva(idSucursal: 999))).StatusCode);
    }

    [Theory]
    [InlineData(999)]
    [InlineData(2)]
    public async Task RechazaClinicaInexistenteODeOtraSucursal(int idClinica)
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/consultas",
                Nueva(idClinica: idClinica))).StatusCode);
    }

    [Theory]
    [InlineData("motivoConsulta")]
    [InlineData("sintomas")]
    [InlineData("observaciones")]
    public async Task RechazaCamposQueExcedenTrescientosCaracteres(string campo)
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var body = CuerpoBase();
        body[campo] = new string('x', 301);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/consultas", body)).StatusCode);
    }

    [Fact]
    public async Task RechazaFechaNoInformadaSinInventarLimiteFuturo()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var body = CuerpoBase();
        body.Remove("fechaConsulta");
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/consultas", body)).StatusCode);
        body["fechaConsulta"] = DateTime.UtcNow.AddDays(1);
        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/consultas", body)).StatusCode);
    }

    [Fact]
    public async Task ListaFiltraPaginaYSoloEntregaDetalleClinicoPorId()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantReadAsync();
        await factory.LinkUserToMedicoAsync(1);
        await factory.SeedConsultasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var page = await client.GetFromJsonAsync<PagedResponse<ConsultaListadoDto>>(
            "/api/consultas?page=2&pageSize=1");
        Assert.NotNull(page);
        Assert.Equal(2, page.TotalCount);
        Assert.Equal(2, Assert.Single(page.Items).IdConsulta);
        var filtered = await client.GetFromJsonAsync<PagedResponse<ConsultaListadoDto>>(
            "/api/consultas?idPaciente=1&idMedico=1&idSucursal=1&idClinica=1" +
            "&desde=2026-01-15T00:00:00Z&hasta=2026-01-15T23:59:59Z");
        Assert.NotNull(filtered);
        Assert.Single(filtered.Items);
        Assert.Equal(1, filtered.Items[0].IdConsulta);
        Assert.Equal("Motivo", filtered.Items[0].MotivoConsulta);
        Assert.Null(filtered.Items[0].NombrePaciente);
        Assert.Null(filtered.Items[0].NombreMedico);
        Assert.Null(filtered.Items[0].NombreSucursal);
        Assert.Null(filtered.Items[0].NombreClinica);
        var detail = await client.GetFromJsonAsync<ConsultaDetalleDto>("/api/consultas/1");
        Assert.NotNull(detail);
        Assert.Equal("Motivo", detail.MotivoConsulta);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/consultas/9999")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/consultas/3")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/consultas?page=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/consultas?idPaciente=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/consultas?desde=2026-02-01&hasta=2026-01-01")).StatusCode);
    }

    [Fact]
    public async Task EstadoPersistidoSeLeeEnListadoYDetalleSinInferirEstadoParaNull()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantReadAsync();
        await factory.LinkUserToMedicoAsync(1);
        await factory.SeedConsultasAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Consultas.SingleAsync(c => c.IdConsulta == 1)).EstadoConsulta = "En seguimiento";
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var pagina = await client.GetFromJsonAsync<PagedResponse<ConsultaListadoDto>>(
            "/api/consultas?page=1&pageSize=2");
        Assert.NotNull(pagina);
        Assert.Equal(2, pagina.TotalCount);
        Assert.Equal("En seguimiento", pagina.Items[0].EstadoConsulta);
        Assert.Null(pagina.Items[1].EstadoConsulta);

        var primero = await client.GetFromJsonAsync<ConsultaDetalleDto>("/api/consultas/1");
        var historico = await client.GetFromJsonAsync<ConsultaDetalleDto>("/api/consultas/2");
        Assert.Equal("En seguimiento", primero?.EstadoConsulta);
        Assert.Null(historico?.EstadoConsulta);
    }

    [Fact]
    public async Task LosDtosGeneralesNoPermitenEscribirEstadoNiAlteranHistoricos()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantReadAsync();
        await factory.GrantWriteAsync();
        await factory.SeedConsultasAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Consultas.SingleAsync(c => c.IdConsulta == 1)).EstadoConsulta = "Estado existente";
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var body = CuerpoBase();
        body["estadoConsulta"] = "Valor no autorizado";
        var updated = await client.PutAsJsonAsync("/api/consultas/1", body);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal("Estado existente",
            (await updated.Content.ReadFromJsonAsync<ConsultaDetalleDto>())?.EstadoConsulta);

        var created = await client.PostAsJsonAsync("/api/consultas", body);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var nueva = await created.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.NotNull(nueva);
        Assert.Equal("Abierta", nueva.EstadoConsulta);
        await factory.LinkUserToMedicoAsync(1);
        var detalle = await client.GetFromJsonAsync<ConsultaDetalleDto>(
            $"/api/consultas/{nueva.IdConsulta}");
        Assert.Equal("Abierta", detalle?.EstadoConsulta);
        var listado = await client.GetFromJsonAsync<PagedResponse<ConsultaListadoDto>>(
            "/api/consultas");
        Assert.NotNull(listado);
        Assert.Equal("Abierta", Assert.Single(listado.Items,
            item => item.IdConsulta == nueva.IdConsulta).EstadoConsulta);
        var putNuevo = await client.PutAsJsonAsync(
            $"/api/consultas/{nueva.IdConsulta}", body);
        Assert.Equal(HttpStatusCode.OK, putNuevo.StatusCode);
        Assert.Equal("Abierta",
            (await putNuevo.Content.ReadFromJsonAsync<ConsultaDetalleDto>())?.EstadoConsulta);
        using var verificationScope = factory.Services.CreateScope();
        var stored = await verificationScope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.AsNoTracking().OrderBy(c => c.IdConsulta).ToListAsync();
        Assert.Equal("Estado existente", stored[0].EstadoConsulta);
        Assert.Null(stored[1].EstadoConsulta);
        Assert.Null(stored[2].EstadoConsulta);
        Assert.Equal("Abierta", stored[3].EstadoConsulta);
    }

    [Fact]
    public async Task ListaMuestraNombresSoloConPermisosRelacionadosYRespetaClinicaOpcional()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantReadAsync();
        await factory.LinkUserToMedicoAsync(1);
        await factory.GrantRelatedReadAsync(1, "Pacientes", "Empleados", "Sucursales", "Clinicas");
        await factory.SeedConsultasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var page = await client.GetFromJsonAsync<PagedResponse<ConsultaListadoDto>>("/api/consultas");
        Assert.NotNull(page);
        Assert.Equal(2, page.TotalCount);
        var primera = page.Items[0];
        Assert.Equal("Motivo", primera.MotivoConsulta);
        Assert.Equal("Paciente Uno", primera.NombrePaciente);
        Assert.Equal("Médico Uno", primera.NombreMedico);
        Assert.Equal("Uno", primera.NombreSucursal);
        Assert.Equal("Uno", primera.NombreClinica);
        var sinClinica = page.Items[1];
        Assert.Null(sinClinica.IdClinica);
        Assert.Null(sinClinica.NombreClinica);
        Assert.Equal("Paciente Dos", sinClinica.NombrePaciente);
        var json = await client.GetStringAsync("/api/consultas?page=1&pageSize=1");
        var clienteAnterior = JsonSerializer.Deserialize<PagedResponse<ConsultaListadoAnterior>>(
            json, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.NotNull(clienteAnterior);
        Assert.Equal(1, Assert.Single(clienteAnterior.Items).IdConsulta);
    }

    [Fact]
    public async Task ListaConPermisosParcialesNoExponeOtrosNombresYRevocaEnTiempoReal()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantReadAsync();
        await factory.LinkUserToMedicoAsync(1);
        await factory.GrantRelatedReadAsync(1, "Pacientes", "Sucursales");
        await factory.SeedConsultasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var page = await client.GetFromJsonAsync<PagedResponse<ConsultaListadoDto>>("/api/consultas");
        Assert.NotNull(page);
        var item = page.Items[0];
        Assert.Equal("Paciente Uno", item.NombrePaciente);
        Assert.Equal("Uno", item.NombreSucursal);
        Assert.Null(item.NombreMedico);
        Assert.Null(item.NombreClinica);
        await factory.RevokeRelatedReadAsync("Pacientes");
        var revocado = await client.GetFromJsonAsync<PagedResponse<ConsultaListadoDto>>("/api/consultas");
        Assert.NotNull(revocado);
        Assert.Null(revocado.Items[0].NombrePaciente);
        Assert.Equal("Uno", revocado.Items[0].NombreSucursal);
    }

    [Theory]
    [InlineData("Pacientes")]
    [InlineData("Empleados")]
    [InlineData("Sucursales")]
    [InlineData("Clinicas")]
    public async Task CadaNombreRequiereSuPropioPermisoDeConsulta(string modulo)
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantReadAsync();
        await factory.LinkUserToMedicoAsync(1);
        await factory.GrantRelatedReadAsync(1, modulo);
        await factory.SeedConsultasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var page = await client.GetFromJsonAsync<PagedResponse<ConsultaListadoDto>>("/api/consultas");
        Assert.NotNull(page);
        var item = page.Items[0];
        Assert.Equal(modulo == "Pacientes" ? "Paciente Uno" : null, item.NombrePaciente);
        Assert.Equal(modulo == "Empleados" ? "Médico Uno" : null, item.NombreMedico);
        Assert.Equal(modulo == "Sucursales" ? "Uno" : null, item.NombreSucursal);
        Assert.Equal(modulo == "Clinicas" ? "Uno" : null, item.NombreClinica);
    }

    [Fact]
    public async Task ListaConReferenciasFaltantesConservaIdsYSuprimeNombresInexistentes()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantReadAsync();
        await factory.LinkUserToMedicoAsync(1);
        await factory.GrantRelatedReadAsync(1, "Pacientes", "Empleados", "Sucursales", "Clinicas");
        await factory.SeedConsultasAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Pacientes.Remove(await db.Pacientes.SingleAsync(p => p.IdPaciente == 1));
            db.Sucursales.Remove(await db.Sucursales.SingleAsync(s => s.IdSucursal == 1));
            db.Clinicas.Remove(await db.Clinicas.SingleAsync(c => c.IdClinica == 1));
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var page = await client.GetFromJsonAsync<PagedResponse<ConsultaListadoDto>>(
            "/api/consultas?page=1&pageSize=1");
        Assert.NotNull(page);
        Assert.Equal(2, page.TotalCount);
        var item = Assert.Single(page.Items);
        Assert.Equal(1, item.IdConsulta);
        Assert.Equal(1, item.IdPaciente);
        Assert.Equal(1, item.IdClinica);
        Assert.Null(item.NombrePaciente);
        Assert.Equal("Médico Uno", item.NombreMedico);
        Assert.Null(item.NombreSucursal);
        Assert.Null(item.NombreClinica);
    }

    [Fact]
    public void ProyeccionRelacionalUsaUnaConsultaPaginadaConJoinsEnLugarDeNMasUno()
    {
        var options = new DbContextOptionsBuilder<ClinicaDbContext>()
            .UseSqlServer("Server=(local);Database=NotUsed;Trusted_Connection=True;TrustServerCertificate=True")
            .Options;
        using var db = new ClinicaDbContext(options);
        var page = db.Consultas.AsNoTracking().OrderBy(c => c.IdConsulta).Skip(20).Take(20);
        var sql = ConsultaService.ProyectarListado(db, page, true, true, true, true)
            .ToQueryString();
        Assert.Contains("LEFT JOIN [Paciente]", sql);
        Assert.Contains("LEFT JOIN [Empleado]", sql);
        Assert.Contains("LEFT JOIN [Sucursal]", sql);
        Assert.Contains("LEFT JOIN [Clinica]", sql);
        Assert.Contains("OFFSET", sql);
    }

    [Fact]
    public void DtoAnteriorSigueDeserializandoSinCamposNuevos()
    {
        const string anterior = """
            {"idConsulta":1,"idPaciente":2,"idMedico":3,"idSucursal":4,
             "idClinica":null,"fechaConsulta":"2026-01-15T10:30:00Z"}
            """;
        var dto = JsonSerializer.Deserialize<ConsultaListadoDto>(anterior,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.NotNull(dto);
        Assert.Equal(1, dto.IdConsulta);
        Assert.Null(dto.NombrePaciente);
        Assert.Null(dto.MotivoConsulta);
        Assert.Null(dto.EstadoConsulta);
    }

    private sealed record ConsultaListadoAnterior(
        int IdConsulta, int IdPaciente, int IdMedico, int IdSucursal,
        int? IdClinica, DateTime FechaConsulta);

    [Fact]
    public async Task MedicoListaSoloSusConsultasYElFiltroNoAmpliaSuAlcance()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.ConfigureCurrentUserAsMedicoAsync(1);
        await factory.GrantReadAsync(2);
        await factory.GrantRelatedReadAsync(2, "Pacientes", "Empleados", "Sucursales", "Clinicas");
        await factory.SeedConsultasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var propias = await client.GetFromJsonAsync<PagedResponse<ConsultaListadoDto>>(
            "/api/consultas");
        Assert.NotNull(propias);
        Assert.Equal(2, propias.TotalCount);
        Assert.All(propias.Items, consulta => Assert.Equal(1, consulta.IdMedico));
        Assert.All(propias.Items, consulta => Assert.Equal("Médico Uno", consulta.NombreMedico));
        Assert.DoesNotContain(propias.Items, consulta => consulta.IdConsulta == 3);

        var filtroAjeno = await client.GetFromJsonAsync<PagedResponse<ConsultaListadoDto>>(
            "/api/consultas?idMedico=2");
        Assert.NotNull(filtroAjeno);
        Assert.Equal(0, filtroAjeno.TotalCount);
        Assert.Empty(filtroAjeno.Items);

        using var scope = factory.Services.CreateScope();
        Assert.Equal(3, await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.CountAsync());
    }

    [Fact]
    public async Task MedicoObtieneDetallePropioYElAjenoRespondeNoEncontrado()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.ConfigureCurrentUserAsMedicoAsync(1);
        await factory.GrantReadAsync(2);
        await factory.SeedConsultasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var propia = await client.GetAsync("/api/consultas/1");
        var ajena = await client.GetAsync("/api/consultas/3");

        Assert.Equal(HttpStatusCode.OK, propia.StatusCode);
        Assert.Equal(1,
            (await propia.Content.ReadFromJsonAsync<ConsultaDetalleDto>())?.IdMedico);
        Assert.Equal(HttpStatusCode.NotFound, ajena.StatusCode);
        using var scope = factory.Services.CreateScope();
        Assert.Equal(3, await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.CountAsync());
    }

    [Theory]
    [InlineData("usuario")]
    [InlineData("rol")]
    [InlineData("medico")]
    public async Task LecturaMedicaRevalidaEstadoActualSinEfectosSecundarios(string recurso)
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.ConfigureCurrentUserAsMedicoAsync(1);
        await factory.GrantReadAsync(2);
        await factory.SeedConsultasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        if (recurso == "usuario") await factory.SetCurrentUserActiveAsync(false);
        if (recurso == "rol") await factory.SetRoleActiveAsync(2, false);
        if (recurso == "medico") await factory.DeactivateEmpleadoAsync(1);

        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/consultas")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/consultas/1")).StatusCode);
        using var scope = factory.Services.CreateScope();
        Assert.Equal(3, await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.CountAsync());
    }

    [Fact]
    public async Task ActualizaConsultaSinDependenciasYValidaNuevasRelaciones()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        await factory.SeedConsultasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PutAsJsonAsync("/api/consultas/1",
            Actualizar(idPaciente: 2, idMedico: 2, idSucursal: 2, idClinica: 2));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var consulta = await response.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.NotNull(consulta);
        Assert.Equal(2, consulta.IdPaciente);
        Assert.Equal(2, consulta.IdMedico);
        Assert.Equal(2, consulta.IdSucursal);
        Assert.Equal(2, consulta.IdClinica);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync("/api/consultas/1",
                Actualizar(idPaciente: 999, idMedico: 2, idSucursal: 2,
                    idClinica: 2))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PutAsJsonAsync("/api/consultas/9999", Actualizar())).StatusCode);
    }

    [Theory]
    [InlineData("paciente")]
    [InlineData("clinica")]
    [InlineData("sucursal")]
    public async Task RechazaRecursosClinicosInactivosAlActualizarYConservaConsulta(
        string recurso)
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        await factory.SeedConsultasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var body = CuerpoBase();
        body["idClinica"] = 1;
        body["motivoConsulta"] = "No debe persistirse";
        if (recurso == "paciente") body["idPaciente"] = 3;
        if (recurso == "clinica") body["idClinica"] = 3;
        if (recurso == "sucursal")
        {
            body["idSucursal"] = 3;
            body.Remove("idClinica");
        }

        var response = await client.PutAsJsonAsync("/api/consultas/1", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.AsNoTracking().SingleAsync(c => c.IdConsulta == 1);
        Assert.Equal(1, stored.IdPaciente);
        Assert.Equal(1, stored.IdSucursal);
        Assert.Equal(1, stored.IdClinica);
        Assert.Equal("Motivo", stored.MotivoConsulta);
    }

    [Theory]
    [InlineData(3)]
    [InlineData(4)]
    public async Task RechazaMedicoInactivoONoMedicoAlActualizarYConservaConsulta(
        int idMedico)
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        await factory.SeedConsultasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var response = await client.PutAsJsonAsync("/api/consultas/1",
            Actualizar(idMedico: idMedico));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.AsNoTracking().SingleAsync(c => c.IdConsulta == 1);
        Assert.Equal(1, stored.IdMedico);
        Assert.Equal("Motivo", stored.MotivoConsulta);
    }

    [Fact]
    public async Task RevalidaMedicoVinculadoInactivoAunqueNoCambieLaAtribucion()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        await factory.LinkUserToMedicoAsync(1);
        await factory.SeedConsultasAsync();
        await factory.DeactivateEmpleadoAsync(1);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var response = await client.PutAsJsonAsync("/api/consultas/1", new ConsultaUpdateDto
        {
            IdPaciente = 1, IdMedico = 1, IdSucursal = 1, IdClinica = 1,
            FechaConsulta = Fecha, MotivoConsulta = "No debe persistirse"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Consultas.AsNoTracking().SingleAsync(c => c.IdConsulta == 1);
        Assert.Equal("Motivo", stored.MotivoConsulta);
    }

    [Fact]
    public async Task ReferenciaDiagnosticaBloqueaCambioDeAtribucionPeroPermiteNotas()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        await factory.SeedConsultasAsync();
        await factory.GrantHistorialCrearAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var diagnostico = await client.PostAsJsonAsync("/api/diagnosticos",
            new CrearDiagnosticoRequest
            {
                IdConsulta = 1, IdMedico = 1, Descripcion = "Hallazgo"
            });
        Assert.Equal(HttpStatusCode.Created, diagnostico.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PutAsJsonAsync("/api/consultas/1",
                Actualizar(idMedico: 2))).StatusCode);
        var notas = await client.PutAsJsonAsync("/api/consultas/1", new ConsultaUpdateDto
        {
            IdPaciente = 1, IdMedico = 1, IdSucursal = 1, IdClinica = 1,
            FechaConsulta = Fecha, MotivoConsulta = "  Nota   corregida "
        });
        Assert.Equal(HttpStatusCode.OK, notas.StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.Equal(1, (await db.Consultas.SingleAsync(c => c.IdConsulta == 1)).IdMedico);
        Assert.Equal(1, (await db.Diagnosticos.SingleAsync()).IdConsulta);
        Assert.Equal("Nota corregida",
            (await db.Consultas.SingleAsync(c => c.IdConsulta == 1)).MotivoConsulta);
    }

    [Fact]
    public async Task MedicoVinculadoSeDerivaDeIdentidadYNoPuedeSuplantar()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        await factory.LinkUserToMedicoAsync(1);
        await factory.SeedConsultasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var own = await client.PostAsJsonAsync("/api/consultas",
            Nueva(idMedico: null));
        Assert.Equal(HttpStatusCode.Created, own.StatusCode);
        Assert.Equal(1,
            (await own.Content.ReadFromJsonAsync<ConsultaDetalleDto>())?.IdMedico);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/consultas",
                Nueva(idMedico: 2))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync("/api/consultas/3",
                Actualizar(idMedico: 2, idSucursal: 2,
                    idClinica: 2))).StatusCode);
    }

    [Fact]
    public async Task ExigeJwtYPermisosActualesPorOperacionYNoExponeDelete()
    {
        using var factory = new ConsultaApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedConsultasAsync();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/consultas")).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/consultas")).StatusCode);
        await factory.GrantReadAsync();
        await factory.LinkUserToMedicoAsync(1);
        Assert.Equal(HttpStatusCode.OK,
            (await client.GetAsync("/api/consultas")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/consultas", Nueva())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync("/api/consultas/1", Actualizar())).StatusCode);
        await factory.GrantWriteAsync();
        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/consultas", Nueva())).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await client.PutAsJsonAsync("/api/consultas/1", Actualizar())).StatusCode);
        Assert.Equal(HttpStatusCode.MethodNotAllowed,
            (await client.DeleteAsync("/api/consultas/1")).StatusCode);
    }

    [Fact]
    public void MapeoIncluyeEstadoNullableDeTreintaCaracteresYConservaLasFk()
    {
        using var factory = new ConsultaApiFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var entity = db.Model.FindEntityType(typeof(Consulta));
        Assert.NotNull(entity);
        Assert.Equal("Consulta", entity.GetTableName());
        Assert.Equal(16, entity.GetProperties().Count());
        var estado = entity.FindProperty(nameof(Consulta.EstadoConsulta));
        Assert.NotNull(estado);
        Assert.Equal("nvarchar(30)", estado.FindAnnotation("Relational:ColumnType")?.Value);
        Assert.Equal(30, estado.GetMaxLength());
        Assert.True(estado.IsNullable);
        var temperatura = entity.FindProperty(nameof(Consulta.TemperaturaC));
        Assert.NotNull(temperatura);
        Assert.Equal("decimal(4,1)", temperatura.FindAnnotation("Relational:ColumnType")?.Value);
        Assert.Equal(4, temperatura.GetPrecision());
        Assert.Equal(1, temperatura.GetScale());
        Assert.True(temperatura.IsNullable);
        var frecuencia = entity.FindProperty(nameof(Consulta.FrecuenciaCardiaca));
        Assert.NotNull(frecuencia);
        Assert.Equal("smallint", frecuencia.FindAnnotation("Relational:ColumnType")?.Value);
        Assert.True(frecuencia.IsNullable);
        Assert.All(entity.GetProperties(), p => Assert.NotNull(p.PropertyInfo));
        Assert.Equal(4, entity.GetForeignKeys().Count());
        Assert.Equal(4, entity.GetReferencingForeignKeys().Count());
        Assert.All(entity.GetForeignKeys(), fk => Assert.Equal(DeleteBehavior.NoAction, fk.DeleteBehavior));
        Assert.All(entity.GetReferencingForeignKeys(), fk => Assert.Equal(DeleteBehavior.NoAction, fk.DeleteBehavior));
        Assert.True(entity.FindProperty("IdClinica")!.IsNullable);
    }

    [Fact]
    public void ProveedorSqlServerProyectaAmbasColumnasSinConectarseALaBase()
    {
        var options = new DbContextOptionsBuilder<ClinicaDbContext>()
            .UseSqlServer("Server=(local);Database=NotUsed;Trusted_Connection=True;TrustServerCertificate=True")
            .Options;
        using var db = new ClinicaDbContext(options);
        var entity = db.Model.FindEntityType(typeof(Consulta));
        Assert.NotNull(entity);
        Assert.Equal("decimal(4,1)", entity.FindProperty(nameof(Consulta.TemperaturaC))?.GetColumnType());
        Assert.Equal("smallint", entity.FindProperty(nameof(Consulta.FrecuenciaCardiaca))?.GetColumnType());
        var sql = db.Consultas.AsNoTracking().Select(c => new
        {
            c.TemperaturaC,
            c.FrecuenciaCardiaca
        }).ToQueryString();
        Assert.Contains("[TemperaturaC]", sql);
        Assert.Contains("[FrecuenciaCardiaca]", sql);
    }

    [Fact]
    public void DtoDeActualizacionDistingueCamposOmitidosDeNullExplicito()
    {
        const string anterior = """
            {"idPaciente":1,"idMedico":1,"idSucursal":1,"idClinica":1,
             "fechaConsulta":"2026-01-15T10:30:00Z"}
            """;
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var oldClient = JsonSerializer.Deserialize<ConsultaUpdateDto>(anterior, options);
        Assert.NotNull(oldClient);
        Assert.False(oldClient.TemperaturaCEnviada);
        Assert.False(oldClient.FrecuenciaCardiacaEnviada);
        const string conNull = """
            {"idPaciente":1,"idMedico":1,"idSucursal":1,"idClinica":1,
             "fechaConsulta":"2026-01-15T10:30:00Z",
             "temperaturaC":null,"frecuenciaCardiaca":null}
            """;
        var explicitNull = JsonSerializer.Deserialize<ConsultaUpdateDto>(conNull, options);
        Assert.NotNull(explicitNull);
        Assert.True(explicitNull.TemperaturaCEnviada);
        Assert.True(explicitNull.FrecuenciaCardiacaEnviada);
        var outgoing = JsonSerializer.Serialize(oldClient, options);
        Assert.DoesNotContain("temperaturaC", outgoing, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("frecuenciaCardiaca", outgoing, StringComparison.OrdinalIgnoreCase);
    }

    private static Dictionary<string, object?> CuerpoBase() => new()
    {
        ["idPaciente"] = 1, ["idMedico"] = 1, ["idSucursal"] = 1,
        ["fechaConsulta"] = Fecha
    };

    private static ConsultaCreateDto Nueva(
        int idPaciente = 1, int? idMedico = 1, int idSucursal = 1,
        int? idClinica = null) => new()
    {
        IdPaciente = idPaciente, IdMedico = idMedico, IdSucursal = idSucursal,
        IdClinica = idClinica, FechaConsulta = Fecha
    };

    private static ConsultaUpdateDto Actualizar(
        int idPaciente = 1, int? idMedico = 1, int idSucursal = 1,
        int? idClinica = 1) => new()
    {
        IdPaciente = idPaciente, IdMedico = idMedico, IdSucursal = idSucursal,
        IdClinica = idClinica, FechaConsulta = Fecha
    };

    private static async Task LoginAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "consultas.prueba", Password = password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(response);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    private sealed class ConsultaApiFactory(bool fallarEvaluacion = false)
        : WebApplicationFactory<Program>
    {
        private readonly string databaseName = Guid.NewGuid().ToString("N");
        private readonly string signingKey = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureLogging(logging => logging.ClearProviders());
            builder.ConfigureAppConfiguration((_, configuration) =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:DefaultConnection"] =
                        "Server=(local);Database=NotUsedInMemory;Trusted_Connection=True;TrustServerCertificate=True",
                    ["Jwt:Issuer"] = "API-Clinica.Tests",
                    ["Jwt:Audience"] = "API-Clinica.Tests.Client",
                    ["Jwt:SigningKey"] = signingKey,
                    ["Jwt:ExpirationMinutes"] = "60",
                    ["Logging:EventLog:LogLevel:Default"] = "None"
                }));
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<DbContextOptions<ClinicaDbContext>>();
                services.RemoveAll<ClinicaDbContext>();
                var options = new DbContextOptionsBuilder<ClinicaDbContext>()
                    .UseInMemoryDatabase(databaseName);
                if (fallarEvaluacion)
                    options.AddInterceptors(new FalloEvaluacionInterceptor());
                services.AddSingleton(options.Options);
                services.AddScoped<ClinicaDbContext>();
            });
        }

        private sealed class FalloEvaluacionInterceptor : SaveChangesInterceptor
        {
            public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
                DbContextEventData eventData, InterceptionResult<int> result,
                CancellationToken cancellationToken = default)
            {
                if (eventData.Context?.ChangeTracker.Entries<Consulta>().Any(entry =>
                    entry.State == EntityState.Modified &&
                    entry.Entity.EstadoConsulta == "En seguimiento") == true)
                    throw new InvalidOperationException("Fallo sintético antes de persistir.");
                return base.SavingChangesAsync(eventData, result, cancellationToken);
            }
        }

        public async Task<string> SeedAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Usuario>>();
            var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
            db.Roles.Add(new Rol { IdRol = 1, Nombre = "Prueba", Activo = true });
            db.Sucursales.AddRange(
                new Sucursal { IdSucursal = 1, Nombre = "Uno", Activa = true },
                new Sucursal { IdSucursal = 2, Nombre = "Dos", Activa = true },
                new Sucursal { IdSucursal = 3, Nombre = "Inactiva", Activa = false });
            db.Pacientes.AddRange(
                new Paciente { IdPaciente = 1, Nombres = "Paciente", Apellidos = "Uno",
                    FechaNacimiento = new DateOnly(1990, 1, 1), FechaRegistro = DateTime.UtcNow,
                    Activo = true },
                new Paciente { IdPaciente = 2, Nombres = "Paciente", Apellidos = "Dos",
                    FechaNacimiento = new DateOnly(1991, 1, 1), FechaRegistro = DateTime.UtcNow,
                    Activo = true },
                new Paciente { IdPaciente = 3, Nombres = "Paciente", Apellidos = "Inactivo",
                    FechaNacimiento = new DateOnly(1992, 1, 1), FechaRegistro = DateTime.UtcNow,
                    Activo = false });
            db.Empleados.AddRange(
                new Empleado { IdEmpleado = 1, IdSucursal = 1, Nombres = "Médico", Apellidos = "Uno",
                    DPI = "MED-1", TipoEmpleado = "Medico", Activo = true },
                new Empleado { IdEmpleado = 2, IdSucursal = 2, Nombres = "Médico", Apellidos = "Dos",
                    DPI = "MED-2", TipoEmpleado = "Medico", Activo = true },
                new Empleado { IdEmpleado = 3, IdSucursal = 1, Nombres = "Médico", Apellidos = "Inactivo",
                    DPI = "MED-3", TipoEmpleado = "Medico", Activo = false },
                new Empleado { IdEmpleado = 4, IdSucursal = 1, Nombres = "Enfermera", Apellidos = "Uno",
                    DPI = "ENF-4", TipoEmpleado = "Enfermera", Activo = true });
            db.Clinicas.AddRange(
                new Clinica { IdClinica = 1, IdSucursal = 1, NombreClinica = "Uno", Activa = true },
                new Clinica { IdClinica = 2, IdSucursal = 2, NombreClinica = "Dos", Activa = true },
                new Clinica { IdClinica = 3, IdSucursal = 1, NombreClinica = "Inactiva",
                    Activa = false });
            var user = new Usuario
            {
                IdUsuario = 1, IdRol = 1, Username = "consultas.prueba", Activo = true
            };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Usuarios.Add(user);
            await db.SaveChangesAsync();
            return password;
        }

        public async Task SeedConsultasAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Consultas.AddRange(
                new Consulta { IdConsulta = 1, IdPaciente = 1, IdMedico = 1, IdSucursal = 1,
                    IdClinica = 1, FechaConsulta = Fecha, MotivoConsulta = "Motivo" },
                new Consulta { IdConsulta = 2, IdPaciente = 2, IdMedico = 1, IdSucursal = 1,
                    FechaConsulta = Fecha.AddDays(1) },
                new Consulta { IdConsulta = 3, IdPaciente = 1, IdMedico = 2, IdSucursal = 2,
                    IdClinica = 2, FechaConsulta = Fecha.AddDays(2) });
            await db.SaveChangesAsync();
        }

        public async Task LinkUserToMedicoAsync(int idEmpleado)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Usuarios.SingleAsync()).IdEmpleado = idEmpleado;
            await db.SaveChangesAsync();
        }

        public async Task ConfigureCurrentUserAsMedicoAsync(int idEmpleado)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Roles.Add(new Rol { IdRol = 2, Nombre = "MEDICO", Activo = true });
            var usuario = await db.Usuarios.SingleAsync();
            usuario.IdRol = 2;
            usuario.IdEmpleado = idEmpleado;
            await db.SaveChangesAsync();
        }

        public async Task SetCurrentUserActiveAsync(bool activo)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Usuarios.SingleAsync()).Activo = activo;
            await db.SaveChangesAsync();
        }

        public async Task SetRoleActiveAsync(int idRol, bool activo)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Roles.SingleAsync(rol => rol.IdRol == idRol)).Activo = activo;
            await db.SaveChangesAsync();
        }

        public async Task DeactivateEmpleadoAsync(int idEmpleado)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Empleados.SingleAsync(e => e.IdEmpleado == idEmpleado)).Activo = false;
            await db.SaveChangesAsync();
        }

        public async Task GrantReadAsync(int idRol = 1)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Permisos.Add(new Permiso
                { IdRol = idRol, Modulo = "Consultas", PuedeConsultar = true });
            await db.SaveChangesAsync();
        }

        public async Task GrantRelatedReadAsync(int idRol, params string[] modulos)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Permisos.AddRange(modulos.Select(modulo => new Permiso
                { IdRol = idRol, Modulo = modulo, PuedeConsultar = true }));
            await db.SaveChangesAsync();
        }

        public async Task RevokeRelatedReadAsync(string modulo)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Permisos.SingleAsync(p => p.Modulo == modulo)).PuedeConsultar = false;
            await db.SaveChangesAsync();
        }

        public async Task GrantWriteAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var permiso = await db.Permisos.SingleAsync(p => p.Modulo == "Consultas");
            permiso.PuedeCrear = true;
            permiso.PuedeModificar = true;
            await db.SaveChangesAsync();
        }

        public async Task GrantHistorialCrearAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Permisos.Add(new Permiso { IdRol = 1, Modulo = "Historial", PuedeCrear = true });
            await db.SaveChangesAsync();
        }

        public async Task GrantAllAsync()
        {
            await GrantReadAsync();
            await GrantWriteAsync();
        }
    }
}
