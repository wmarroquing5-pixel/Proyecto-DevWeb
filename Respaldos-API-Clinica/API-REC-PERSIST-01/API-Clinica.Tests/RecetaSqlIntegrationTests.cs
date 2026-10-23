using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Data.Common;
using System.Text.Json;
using API_Clinica.DTOs;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit.Abstractions;

namespace API_Clinica.Tests;

public sealed class RecetaSqlIntegrationTests(ITestOutputHelper output)
{
    [SqlIntegrationFact]
    public async Task Crear_y_consultar_receta_usa_esquema_aislado_y_no_mueve_inventario()
    {
        await using var db = await RecetaSqlTestDatabase.CreateAsync();
        output.WriteLine($"Base temporal: {db.DatabaseName}");
        try
        {
            using var factory = db.CreateFactory();
            using var client = Client(db, factory, 1, 1, 1);
            var stockBefore = await db.ScalarAsync("SELECT CantidadDisponible FROM dbo.LoteMedicamento WHERE IdLote=1");
            var movesBefore = await db.ScalarAsync("SELECT COUNT(*) FROM dbo.MovimientoInventario");
            var request = Request(1, 1, Guid.NewGuid(), [Line(1, 7, "tabletas")]);
            var response = await client.PostAsJsonAsync("/api/consultas/1/recetas", request);
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.Created, $"HTTP {(int)response.StatusCode}: {body}");
            var receta = JsonDocument.Parse(body).RootElement;
            var id = receta.GetProperty("idReceta").GetInt32();
            Assert.Equal("Vigente", receta.GetProperty("estado").GetString());
            Assert.Equal(1, receta.GetProperty("numeroVersion").GetInt32());
            Assert.Equal(1, receta.GetProperty("lineas").GetArrayLength());
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento WHERE IdConsulta=1 AND Descripcion=N'Tratamiento sintético' AND Indicaciones=N'Prueba aislada' AND FechaInicio='2026-10-23' AND FechaFin='2026-10-27' AND IdLote IS NULL AND Cantidad IS NULL"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica r JOIN dbo.Tratamiento t ON t.IdTratamiento=r.IdTratamiento WHERE t.IdConsulta=1 AND r.IdDiagnostico=1"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea"));
            Assert.Equal(7, await db.ScalarAsync("SELECT CantidadPrescritaUnidades FROM dbo.RecetaLinea"));
            Assert.Equal("tabletas", (await ScalarStringAsync(db, "SELECT UnidadInventario FROM dbo.RecetaLinea")));
            Assert.Equal("Clinica", await ScalarStringAsync(db, "SELECT DestinoMedicamento FROM dbo.RecetaLinea"));
            Assert.Equal(5, await db.ScalarAsync("SELECT DuracionDias FROM dbo.RecetaLinea"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea WHERE Dosis IS NULL AND UnidadDosis IS NULL AND Via IS NULL AND Frecuencia IS NULL AND Indicaciones IS NULL"));
            Assert.Equal(0, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea WHERE ContenidoPorUnidad IS NOT NULL OR UnidadContenido IS NOT NULL OR FuenteEquivalencia IS NOT NULL OR VersionEquivalencia IS NOT NULL OR IdUsuarioValidador IS NOT NULL OR FechaValidacionUtc IS NOT NULL"));
            Assert.Equal(stockBefore, await db.ScalarAsync("SELECT CantidadDisponible FROM dbo.LoteMedicamento WHERE IdLote=1"));
            Assert.Equal(movesBefore, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.MovimientoInventario"));
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/recetas/{id}")).StatusCode);
            var list = await client.GetAsync("/api/consultas/1/recetas");
            Assert.Equal(HttpStatusCode.OK, list.StatusCode);
            var listed = JsonDocument.Parse(await list.Content.ReadAsStringAsync()).RootElement;
            Assert.Single(listed.GetProperty("items").EnumerateArray());
        }
        finally { await db.DisposeAsync(); output.WriteLine($"Base eliminada: {db.DatabaseName}"); }
    }

    [SqlIntegrationFact]
    public async Task Varias_lineas_idempotencia_y_concurrencia_no_duplican_recetas()
    {
        await using var db = await RecetaSqlTestDatabase.CreateAsync();
        output.WriteLine($"Base temporal: {db.DatabaseName}");
        try
        {
            using var factory = db.CreateFactory();
            using var client = Client(db, factory, 1, 1, 1);
            var key = Guid.NewGuid();
            var request = Request(1, 1, key, [Line(1, 7, "tabletas"), Line(2, 3, "frascos", "CompraExterna")]);
            var created = await client.PostAsJsonAsync("/api/consultas/1/recetas", request);
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
            var id = JsonDocument.Parse(await created.Content.ReadAsStringAsync()).RootElement.GetProperty("idReceta").GetInt32();
            Assert.Equal(2, await db.ScalarAsync($"SELECT COUNT(*) FROM dbo.RecetaLinea WHERE IdReceta={id}"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(DISTINCT IdReceta) FROM dbo.RecetaLinea"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea WHERE DestinoMedicamento=N'CompraExterna'"));
            Assert.Equal(25, await db.ScalarAsync("SELECT CantidadDisponible FROM dbo.LoteMedicamento WHERE IdLote=1"));
            Assert.Equal(0, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.MovimientoInventario"));
            var replay = await client.PostAsJsonAsync("/api/consultas/1/recetas", request);
            Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
            Assert.Equal(id, JsonDocument.Parse(await replay.Content.ReadAsStringAsync()).RootElement.GetProperty("idReceta").GetInt32());
            var changed = Request(1, 1, key, [Line(1, 8, "tabletas"), Line(2, 3, "frascos", "CompraExterna")]);
            Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/consultas/1/recetas", changed)).StatusCode);
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
            Assert.Equal(2, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea"));

            var simultaneous = Request(2, 2, Guid.NewGuid(), [Line(1, 11, "tabletas")]);
            using var second = Client(db, factory, 1, 1, 1);
            var calls = await Task.WhenAll(
                client.PostAsJsonAsync("/api/consultas/2/recetas", simultaneous),
                second.PostAsJsonAsync("/api/consultas/2/recetas", simultaneous));
            Assert.Contains(calls, r => r.StatusCode == HttpStatusCode.Created);
            foreach (var response in calls)
                Assert.Contains(response.StatusCode, new[] { HttpStatusCode.Created, HttpStatusCode.OK, HttpStatusCode.Conflict });
            if (calls.Any(r => r.StatusCode == HttpStatusCode.Conflict))
                Assert.Equal(HttpStatusCode.OK,
                    (await client.PostAsJsonAsync("/api/consultas/2/recetas", simultaneous)).StatusCode);
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica WHERE ClaveOperacion = '" + simultaneous.ClaveOperacion + "'"));
            Assert.Equal(2, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
            Assert.Equal(2, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
        }
        finally { await db.DisposeAsync(); output.WriteLine($"Base eliminada: {db.DatabaseName}"); }
    }

    [SqlIntegrationFact]
    public async Task Reglas_clinicas_y_permisos_rechazan_accesos_invalidos()
    {
        await using var db = await RecetaSqlTestDatabase.CreateAsync();
        output.WriteLine($"Base temporal: {db.DatabaseName}");
        try
        {
            using var factory = db.CreateFactory();
            using var allowed = Client(db, factory, 1, 1, 1);
            using var noPermission = Client(db, factory, 3, 2, 1);
            using var otherDoctor = Client(db, factory, 2, 1, 2);
            Assert.Equal(HttpStatusCode.NotFound,
                (await allowed.PostAsJsonAsync("/api/consultas/1/recetas", Request(1, 4, Guid.NewGuid(), [Line(1, 1, "tableta")]))).StatusCode);
            Assert.Equal(HttpStatusCode.Conflict,
                (await allowed.PostAsJsonAsync("/api/consultas/3/recetas", Request(3, 3, Guid.NewGuid(), [Line(1, 1, "tableta")]))).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden,
                (await noPermission.PostAsJsonAsync("/api/consultas/1/recetas", Request(1, 1, Guid.NewGuid(), [Line(1, 1, "tableta")]))).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden,
                (await otherDoctor.PostAsJsonAsync("/api/consultas/1/recetas", Request(1, 1, Guid.NewGuid(), [Line(1, 1, "tableta")]))).StatusCode);
            Assert.Equal(HttpStatusCode.Created,
                (await allowed.PostAsJsonAsync("/api/consultas/1/recetas", Request(1, 1, Guid.NewGuid(), [Line(1, 1, "tableta")]))).StatusCode);
            Assert.Equal(HttpStatusCode.Created,
                (await allowed.PostAsJsonAsync("/api/consultas/2/recetas", Request(2, 2, Guid.NewGuid(), [Line(2, 2, "frasco")]))).StatusCode);
            Assert.Equal(2, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
        }
        finally { await db.DisposeAsync(); output.WriteLine($"Base eliminada: {db.DatabaseName}"); }
    }

    [SqlIntegrationFact]
    public async Task Error_en_linea_revierte_todo_y_restricciones_sql_permanecen_activas()
    {
        await using var db = await RecetaSqlTestDatabase.CreateAsync();
        output.WriteLine($"Base temporal: {db.DatabaseName}");
        try
        {
            using (var factory = db.CreateFactory(new FailLineInsert()))
            using (var client = Client(db, factory, 1, 1, 1))
            {
                var response = await client.PostAsJsonAsync("/api/consultas/1/recetas",
                    Request(1, 1, Guid.NewGuid(), [Line(1, 1, "tableta")]));
                Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
            }
            Assert.Equal(0, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
            Assert.Equal(0, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
            Assert.Equal(0, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea"));
            using var normalFactory = db.CreateFactory();
            using var normal = Client(db, normalFactory, 1, 1, 1);
            var responseOk = await normal.PostAsJsonAsync("/api/consultas/1/recetas",
                Request(1, 1, Guid.NewGuid(), [Line(1, 1, "tableta")]));
            Assert.Equal(HttpStatusCode.Created, responseOk.StatusCode);
            var id = JsonDocument.Parse(await responseOk.Content.ReadAsStringAsync()).RootElement.GetProperty("idReceta").GetInt32();
            var treatment = await db.ScalarAsync("SELECT IdTratamiento FROM dbo.RecetaClinica WHERE IdReceta=" + id);
            var validLine = "INSERT dbo.RecetaLinea (IdReceta,IdMedicamento,Orden,CantidadPrescritaUnidades,UnidadInventario,DuracionDias,DestinoMedicamento) VALUES (" + id + ",2,2,1,N'tableta',1,N'Clinica')";
            await AssertSqlErrorAsync(db, validLine.Replace($"VALUES ({id},2", "VALUES (999999,2"), 547); // FK
            await AssertSqlErrorAsync(db, validLine.Replace(",2,2,1,", ",2,2,0,"), 547); // CHECK
            await AssertSqlErrorAsync(db, validLine.Replace(",2,2,1,", ",2,1,1,"), 2627); // orden
            // La unicidad de clave y de (tratamiento, versión) se verifica con una segunda fila sintética.
            var duplicate = "INSERT dbo.RecetaClinica (IdTratamiento,IdDiagnostico,IdUsuarioPrescriptor,NumeroVersion,Estado,FechaPrescripcionUtc,ClaveOperacion,HashSolicitud) VALUES (" + treatment + ",1,1,2,N'Sustituida',SYSUTCDATETIME(),(SELECT ClaveOperacion FROM dbo.RecetaClinica WHERE IdReceta=" + id + "),0x" + new string('0', 64) + ")";
            await AssertSqlErrorAsync(db, duplicate, 2627);
            duplicate = duplicate.Replace("1,1,2,N'Sustituida'", "1,1,1,N'Sustituida'").Replace("(SELECT ClaveOperacion FROM dbo.RecetaClinica WHERE IdReceta=" + id + ")", "NEWID()");
            await AssertSqlErrorAsync(db, duplicate, 2627);
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
        }
        finally { await db.DisposeAsync(); output.WriteLine($"Base eliminada: {db.DatabaseName}"); }
    }

    private sealed class FailLineInsert : DbCommandInterceptor
    {
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("INSERT INTO [dbo].[RecetaLinea]", StringComparison.Ordinal))
                throw new InvalidOperationException("Fallo sintético al insertar una línea.");
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    private static async Task AssertSqlErrorAsync(RecetaSqlTestDatabase db, string sql, int errorNumber)
    {
        var error = await Assert.ThrowsAsync<SqlException>(() => db.ExecuteAsync(sql));
        Assert.Equal(errorNumber, error.Number);
    }

    private static HttpClient Client(RecetaSqlTestDatabase db,
        Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> factory,
        int user, int role, int doctor)
    {
        var client = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", db.Token(factory, user, role, doctor));
        return client;
    }

    private static CrearRecetaClinicaRequest Request(int consulta, int diagnostico, Guid key,
        IReadOnlyList<RecetaLineaCrearRequest> lines) => new()
    {
        IdConsulta = consulta, IdDiagnostico = diagnostico, ClaveOperacion = key,
        DescripcionTratamiento = "Tratamiento sintético", IndicacionesGenerales = "Prueba aislada",
        FechaInicio = new DateOnly(2026, 10, 23), FechaFin = new DateOnly(2026, 10, 27), Lineas = lines
    };

    private static RecetaLineaCrearRequest Line(int medicamento, int quantity, string unit,
        string destino = "Clinica") => new()
    {
        IdMedicamento = medicamento, CantidadPrescritaUnidades = quantity,
        UnidadInventario = unit, DestinoMedicamento = destino
    };

    private static async Task<string> ScalarStringAsync(RecetaSqlTestDatabase db, string sql)
    {
        await using var connection = new SqlConnection(db.ConnectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand(sql, connection);
        return (string)(await command.ExecuteScalarAsync())!;
    }
}

public sealed class SqlIntegrationFactAttribute : FactAttribute
{
    public SqlIntegrationFactAttribute()
    {
        if (Environment.GetEnvironmentVariable("CLINICA_SQL_INTEGRATION") != "1")
            Skip = "Requiere CLINICA_SQL_INTEGRATION=1 y SQL Server Express local.";
    }
}
