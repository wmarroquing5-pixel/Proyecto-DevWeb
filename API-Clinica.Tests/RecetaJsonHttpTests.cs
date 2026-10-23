using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using API_Clinica.Controllers;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace API_Clinica.Tests;

public sealed class RecetaJsonHttpTests
{
    [Fact]
    public async Task PostAceptaLineaSimpleEnJsonCamelCase()
    {
        var (app, client, service) = await StartAsync();
        await using (app)
        {
            var response = await client.PostAsJsonAsync("/api/consultas/17/recetas", Payload());
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            Assert.Equal(3, service.LastRequest?.Lineas[0].IdMedicamento);
            Assert.Equal(10, service.LastRequest?.Lineas[0].CantidadPrescritaUnidades);
        }
    }

    [Fact]
    public async Task PostConDestinoExtraProduce400SinLlamarAlServicio()
    {
        var (app, client, service) = await StartAsync();
        await using (app)
        {
            const string json = "{\"idConsulta\":17,\"lineas\":[{\"idMedicamento\":3,\"cantidadPrescritaUnidades\":10,\"destinoMedicamento\":\"Clinica\"}]}";
            var response = await client.PostAsync("/api/consultas/17/recetas",
                new StringContent(json, System.Text.Encoding.UTF8, "application/json"));
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var errors = body.RootElement.GetProperty("errors");
            Assert.True(errors.TryGetProperty("$.lineas[0].destinoMedicamento", out _));
            Assert.Null(service.LastRequest);
        }
    }

    private static object Payload() => new
    {
        idConsulta = 17, idDiagnostico = 4,
        claveOperacion = "1d78bd51-5166-4b78-89cd-15ad6e42eac7",
        descripcionTratamiento = "Tratamiento sintético",
        fechaInicio = "2026-10-23", fechaFin = "2026-10-27",
        lineas = new[] { new { idMedicamento = 3, cantidadPrescritaUnidades = 10 } }
    };

    private static async Task<(WebApplication App, HttpClient Client, FakeService Service)> StartAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddControllers().AddApplicationPart(typeof(RecetasClinicasController).Assembly);
        builder.Services.AddAuthorization(options => options.AddPolicy(
            "Permiso:Historial:Crear", policy => policy.RequireAssertion(_ => true)));
        var service = new FakeService();
        builder.Services.AddSingleton<IRecetaClinicaService>(service);
        var app = builder.Build();
        app.UseAuthorization();
        app.MapControllers();
        await app.StartAsync();
        return (app, app.GetTestClient(), service);
    }

    private sealed class FakeService : IRecetaClinicaService
    {
        public CrearRecetaClinicaRequest? LastRequest { get; private set; }

        public Task<RecetaCreacionResultado> CrearAsync(CrearRecetaClinicaRequest request,
            ClaimsPrincipal principal, CancellationToken ct)
        {
            LastRequest = request;
            return Task.FromResult(new RecetaCreacionResultado(new RecetaClinicaDetalleDto(
                21, 17, 30, "Tratamiento sintético", null, new DateOnly(2026, 10, 23),
                new DateOnly(2026, 10, 27), 4, "Diagnóstico sintético", 1, "Vigente", 7,
                DateTime.UtcNow, []), false));
        }

        public Task<RecetaClinicaDetalleDto> ObtenerAsync(int idReceta,
            ClaimsPrincipal principal, CancellationToken ct) => throw new NotImplementedException();

        public Task<PagedResponse<RecetaClinicaResumenDto>> ListarPorConsultaAsync(int idConsulta,
            int page, int pageSize, ClaimsPrincipal principal, CancellationToken ct) =>
            throw new NotImplementedException();
    }
}
