using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Data.Common;
using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using API_Clinica.DTOs;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit.Abstractions;

namespace API_Clinica.Tests;

public sealed class RecetaSqlIntegrationTests(ITestOutputHelper output)
{
    [SqlIntegrationFact]
    public async Task Tratamiento_independiente_se_guarda_y_relee_sin_receta_ni_movimiento()
    {
        await using var db = await RecetaSqlTestDatabase.CreateAsync();
        output.WriteLine($"Base temporal: {db.DatabaseName}");
        try
        {
            using var factory = db.CreateFactory();
            using var client = Client(db, factory, 1, 1, 1);
            var stockBefore = await db.ScalarAsync("SELECT CantidadDisponible FROM dbo.LoteMedicamento WHERE IdLote=1");
            var movesBefore = await db.ScalarAsync("SELECT COUNT(*) FROM dbo.MovimientoInventario");
            var response = await client.PostAsJsonAsync("/api/tratamientos", new TratamientoCreateDto
            {
                IdConsulta = 1, Descripcion = "Reposo sintético",
                Indicaciones = "Hidratación", FechaInicio = new DateOnly(2026, 10, 23),
                FechaFin = new DateOnly(2026, 10, 27), IdLote = null, Cantidad = null
            });
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var creado = await response.Content.ReadFromJsonAsync<TratamientoResponseDto>();
            Assert.NotNull(creado);
            Assert.Equal(1, creado.IdConsulta);
            Assert.Equal("Reposo sintético", creado.Descripcion);
            Assert.Equal("Hidratación", creado.Indicaciones);
            Assert.Null(creado.IdLote);
            Assert.Null(creado.Cantidad);
            Assert.Equal(HttpStatusCode.OK,
                (await client.GetAsync($"/api/tratamientos/{creado.IdTratamiento}")).StatusCode);
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento WHERE IdConsulta=1 AND IdLote IS NULL AND Cantidad IS NULL"));
            Assert.Equal(0, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
            Assert.Equal(0, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea"));
            Assert.Equal(stockBefore, await db.ScalarAsync("SELECT CantidadDisponible FROM dbo.LoteMedicamento WHERE IdLote=1"));
            Assert.Equal(movesBefore, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.MovimientoInventario"));
        }
        finally { await db.DisposeAsync(); output.WriteLine($"Base eliminada: {db.DatabaseName}"); }
    }

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
            var request = Request(1, 1, Guid.NewGuid(), [Line(1, 7)]);
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
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea WHERE UnidadInventario IS NULL AND Dosis IS NULL AND UnidadDosis IS NULL AND Via IS NULL AND Frecuencia IS NULL AND DuracionDias IS NULL"));
            Assert.Equal("Caja 99 x 500 mg", receta.GetProperty("lineas")[0].GetProperty("presentacion").GetString());
            Assert.Equal(11, await db.ScalarAsync("SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.RecetaLinea')"));
            Assert.Equal(5, await db.ScalarAsync("SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.RecetaLinea') AND is_nullable=0"));
            Assert.Equal(6, await db.ScalarAsync("SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.RecetaLinea') AND is_nullable=1"));
            Assert.Equal(2, await db.ScalarAsync("SELECT COUNT(*) FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.RecetaLinea') AND is_disabled=0 AND is_not_trusted=0"));
            Assert.Equal(2, await db.ScalarAsync("SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID(N'dbo.RecetaLinea')"));
            Assert.Equal(stockBefore, await db.ScalarAsync("SELECT CantidadDisponible FROM dbo.LoteMedicamento WHERE IdLote=1"));
            Assert.Equal(movesBefore, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.MovimientoInventario"));
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/recetas/{id}")).StatusCode);
            var list = await client.GetAsync("/api/consultas/1/recetas");
            Assert.Equal(HttpStatusCode.OK, list.StatusCode);
            var listed = JsonDocument.Parse(await list.Content.ReadAsStringAsync()).RootElement;
            Assert.Single(listed.GetProperty("items").EnumerateArray());
            await db.ExecuteAsync("UPDATE dbo.Medicamento SET Presentacion=NULL WHERE IdMedicamento=1");
            var withoutPresentation = await client.GetAsync($"/api/recetas/{id}");
            Assert.Equal(HttpStatusCode.OK, withoutPresentation.StatusCode);
            var updated = JsonDocument.Parse(await withoutPresentation.Content.ReadAsStringAsync()).RootElement;
            Assert.Equal("No registrada", updated.GetProperty("lineas")[0].GetProperty("presentacion").GetString());
        }
        finally { await db.DisposeAsync(); output.WriteLine($"Base eliminada: {db.DatabaseName}"); }
    }

    [SqlIntegrationFact]
    public async Task RespuestaNoRecibidaSeReconciliaConLaMismaClave()
    {
        await using var db = await RecetaSqlTestDatabase.CreateAsync();
        output.WriteLine($"Base temporal: {db.DatabaseName}");
        try
        {
            using var factory = db.CreateFactory();
            using var client = Client(db, factory, 1, 1, 1);
            var request = Request(1, 1, Guid.NewGuid(), [Line(1, 4)]);
            // El cliente no utiliza el cuerpo de la primera respuesta: simula
            // pérdida de confirmación después de que la transacción terminó.
            using (var first = await client.PostAsJsonAsync("/api/consultas/1/recetas", request))
                Assert.Equal(HttpStatusCode.Created, first.StatusCode);
            var retry = await client.PostAsJsonAsync("/api/consultas/1/recetas", request);
            Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea"));
        }
        finally { await db.DisposeAsync(); output.WriteLine($"Base eliminada: {db.DatabaseName}"); }
    }

    [SqlIntegrationFact]
    public async Task ClaveHistoricaConHashAnteriorNoSeReinterpretaNiDuplica()
    {
        await using var db = await RecetaSqlTestDatabase.CreateAsync();
        output.WriteLine($"Base temporal: {db.DatabaseName}");
        try
        {
            using var factory = db.CreateFactory();
            using var client = Client(db, factory, 1, 1, 1);
            var request = Request(1, 1, Guid.NewGuid(), [Line(1, 7)]);
            Assert.Equal(HttpStatusCode.Created,
                (await client.PostAsJsonAsync("/api/consultas/1/recetas", request)).StatusCode);
            var oldBody = JsonSerializer.Serialize(new
            {
                Version = 2, request.IdConsulta, request.IdDiagnostico,
                request.DescripcionTratamiento, request.IndicacionesGenerales,
                request.FechaInicio, request.FechaFin,
                Lineas = new[] { new { Orden = 1, IdMedicamento = 1,
                    UnidadInventario = "tableta", CantidadPrescritaUnidades = 7,
                    DestinoMedicamento = "Clinica" } }
            });
            var oldHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(oldBody)));
            await db.ExecuteAsync($"UPDATE dbo.RecetaClinica SET HashSolicitud=0x{oldHash} WHERE ClaveOperacion='{request.ClaveOperacion}'");
            Assert.Equal(HttpStatusCode.Conflict,
                (await client.PostAsJsonAsync("/api/consultas/1/recetas", request)).StatusCode);
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea"));
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
            var request = Request(1, 1, key, [Line(1, 7), Line(2, 3)]);
            var created = await client.PostAsJsonAsync("/api/consultas/1/recetas", request);
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
            var id = JsonDocument.Parse(await created.Content.ReadAsStringAsync()).RootElement.GetProperty("idReceta").GetInt32();
            Assert.Equal(2, await db.ScalarAsync($"SELECT COUNT(*) FROM dbo.RecetaLinea WHERE IdReceta={id}"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(DISTINCT IdReceta) FROM dbo.RecetaLinea"));
            Assert.Equal(2, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea WHERE UnidadInventario IS NULL AND DuracionDias IS NULL"));
            Assert.Equal(25, await db.ScalarAsync("SELECT CantidadDisponible FROM dbo.LoteMedicamento WHERE IdLote=1"));
            Assert.Equal(0, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.MovimientoInventario"));
            var replay = await client.PostAsJsonAsync("/api/consultas/1/recetas", request);
            Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
            var replayBody = await replay.Content.ReadAsStringAsync();
            Assert.Equal(id, JsonDocument.Parse(replayBody).RootElement.GetProperty("idReceta").GetInt32());
            Assert.True(JsonElement.DeepEquals(
                JsonDocument.Parse(await created.Content.ReadAsStringAsync()).RootElement,
                JsonDocument.Parse(replayBody).RootElement));
            var changed = Request(1, 1, key, [Line(1, 8), Line(2, 3)]);
            Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/consultas/1/recetas", changed)).StatusCode);
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
            Assert.Equal(2, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea"));

            var simultaneous = Request(2, 2, Guid.NewGuid(), [Line(1, 11)]);
            using var second = Client(db, factory, 1, 1, 1);
            var calls = await Task.WhenAll(
                client.PostAsJsonAsync("/api/consultas/2/recetas", simultaneous),
                second.PostAsJsonAsync("/api/consultas/2/recetas", simultaneous));
            Assert.Contains(calls, r => r.StatusCode == HttpStatusCode.Created);
            foreach (var response in calls)
                Assert.Contains(response.StatusCode, new[] { HttpStatusCode.Created, HttpStatusCode.OK,
                    HttpStatusCode.Conflict, HttpStatusCode.ServiceUnavailable });
            if (calls.Any(r => r.StatusCode is HttpStatusCode.Conflict or HttpStatusCode.ServiceUnavailable))
                Assert.Equal(HttpStatusCode.OK,
                    (await client.PostAsJsonAsync("/api/consultas/2/recetas", simultaneous)).StatusCode);
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica WHERE ClaveOperacion = '" + simultaneous.ClaveOperacion + "'"));
            Assert.Equal(2, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
            Assert.Equal(2, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
        }
        finally { await db.DisposeAsync(); output.WriteLine($"Base eliminada: {db.DatabaseName}"); }
    }

    [SqlIntegrationFact]
    public async Task FalloAntesDeCommitRevierteYNoReservaLaClave()
    {
        await using var db = await RecetaSqlTestDatabase.CreateAsync();
        output.WriteLine($"Base temporal: {db.DatabaseName}");
        try
        {
            var request = Request(1, 1, Guid.NewGuid(), [Line(1, 4)]);
            using (var factory = db.CreateFactory(new FailBeforeCommit()))
            using (var client = Client(db, factory, 1, 1, 1))
            {
                var response = await client.PostAsJsonAsync("/api/consultas/1/recetas", request);
                Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
            }
            Assert.Equal(0, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
            Assert.Equal(0, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
            Assert.Equal(0, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea"));
            using var normalFactory = db.CreateFactory();
            using var normalClient = Client(db, normalFactory, 1, 1, 1);
            Assert.Equal(HttpStatusCode.Created,
                (await normalClient.PostAsJsonAsync("/api/consultas/1/recetas", request)).StatusCode);
        }
        finally { await db.DisposeAsync(); output.WriteLine($"Base eliminada: {db.DatabaseName}"); }
    }

    [SqlIntegrationFact]
    public async Task FalloDespuesDeCommitNoDevuelve201YLaMismaClaveRecuperaOriginal()
    {
        await using var db = await RecetaSqlTestDatabase.CreateAsync();
        output.WriteLine($"Base temporal: {db.DatabaseName}");
        try
        {
            var request = Request(1, 1, Guid.NewGuid(), [Line(1, 4)]);
            using (var factory = db.CreateFactory(new FailAfterCommit()))
            using (var client = Client(db, factory, 1, 1, 1))
            {
                var response = await client.PostAsJsonAsync("/api/consultas/1/recetas", request);
                Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
            }
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea"));
            using var normalFactory = db.CreateFactory();
            using var normalClient = Client(db, normalFactory, 1, 1, 1);
            var retry = await normalClient.PostAsJsonAsync("/api/consultas/1/recetas", request);
            Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea"));
        }
        finally { await db.DisposeAsync(); output.WriteLine($"Base eliminada: {db.DatabaseName}"); }
    }

    [SqlIntegrationFact]
    public async Task CancelacionTrasCommitConservaLaRecetaYPermiteReconciliarLaClave()
    {
        await using var db = await RecetaSqlTestDatabase.CreateAsync();
        output.WriteLine($"Base temporal: {db.DatabaseName}");
        try
        {
            var request = Request(1, 1, Guid.NewGuid(), [Line(1, 4)]);
            using var cancellation = new CancellationTokenSource();
            using (var factory = db.CreateFactory(new CancelAfterCommit(cancellation)))
            using (var client = Client(db, factory, 1, 1, 1))
            {
                try
                {
                    using var response = await client.PostAsJsonAsync(
                        "/api/consultas/1/recetas", request, cancellation.Token);
                    Assert.NotEqual(HttpStatusCode.Created, response.StatusCode);
                }
                catch (OperationCanceledException) when (cancellation.IsCancellationRequested) { }
            }
            Assert.True(cancellation.IsCancellationRequested);
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea"));
            using var normalFactory = db.CreateFactory();
            using var normalClient = Client(db, normalFactory, 1, 1, 1);
            Assert.Equal(HttpStatusCode.OK,
                (await normalClient.PostAsJsonAsync("/api/consultas/1/recetas", request)).StatusCode);
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
        }
        finally { await db.DisposeAsync(); output.WriteLine($"Base eliminada: {db.DatabaseName}"); }
    }

    [SqlIntegrationFact]
    public async Task ContenidoDistintoConMismaClaveConcurrenteNoCreaOtraReceta()
    {
        await using var db = await RecetaSqlTestDatabase.CreateAsync();
        output.WriteLine($"Base temporal: {db.DatabaseName}");
        try
        {
            using var factory = db.CreateFactory();
            using var firstClient = Client(db, factory, 1, 1, 1);
            using var secondClient = Client(db, factory, 1, 1, 1);
            var key = Guid.NewGuid();
            var first = Request(1, 1, key, [Line(1, 4)]);
            var second = Request(1, 1, key, [Line(1, 5)]);
            var responses = await Task.WhenAll(
                firstClient.PostAsJsonAsync("/api/consultas/1/recetas", first),
                secondClient.PostAsJsonAsync("/api/consultas/1/recetas", second));
            Assert.Contains(responses, r => r.StatusCode == HttpStatusCode.Created);
            Assert.All(responses, r => Assert.Contains(r.StatusCode,
                new[] { HttpStatusCode.Created, HttpStatusCode.Conflict, HttpStatusCode.ServiceUnavailable }));
            // Si SQL elige un interbloqueo, se reconcilia con las mismas claves.
            var conflictObserved = responses.Any(r => r.StatusCode == HttpStatusCode.Conflict);
            for (var index = 0; index < responses.Length; index++)
            {
                var response = responses[index];
                if (response.StatusCode == HttpStatusCode.ServiceUnavailable)
                {
                    var request = index == 0 ? first : second;
                    using var retry = await firstClient.PostAsJsonAsync("/api/consultas/1/recetas", request);
                    Assert.Equal(HttpStatusCode.Conflict, retry.StatusCode);
                    conflictObserved = true;
                }
            }
            Assert.True(conflictObserved);
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea"));
            Assert.Equal(0, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.MovimientoInventario"));
        }
        finally { await db.DisposeAsync(); output.WriteLine($"Base eliminada: {db.DatabaseName}"); }
    }

    [SqlIntegrationFact]
    public async Task ClavesDistintasNoBloqueanDosRecetasIndependientes()
    {
        await using var db = await RecetaSqlTestDatabase.CreateAsync();
        output.WriteLine($"Base temporal: {db.DatabaseName}");
        try
        {
            using var factory = db.CreateFactory();
            using var firstClient = Client(db, factory, 1, 1, 1);
            using var secondClient = Client(db, factory, 1, 1, 1);
            var first = Request(1, 1, Guid.NewGuid(), [Line(1, 4)]);
            var second = Request(1, 1, Guid.NewGuid(), [Line(2, 5)]);
            var responses = await Task.WhenAll(
                firstClient.PostAsJsonAsync("/api/consultas/1/recetas", first),
                secondClient.PostAsJsonAsync("/api/consultas/1/recetas", second));
            for (var index = 0; index < responses.Length; index++)
            {
                var response = responses[index];
                if (response.StatusCode == HttpStatusCode.ServiceUnavailable)
                {
                    var request = index == 0 ? first : second;
                    using var retry = await firstClient.PostAsJsonAsync("/api/consultas/1/recetas", request);
                    Assert.Contains(retry.StatusCode, new[] { HttpStatusCode.Created, HttpStatusCode.OK });
                }
                else Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            }
            Assert.Equal(2, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
            Assert.Equal(2, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
            Assert.Equal(2, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea"));
            Assert.Equal(0, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.MovimientoInventario"));
        }
        finally { await db.DisposeAsync(); output.WriteLine($"Base eliminada: {db.DatabaseName}"); }
    }

    [SqlIntegrationFact]
    public async Task TimeoutDeBloqueoEs503YLaMismaClavePuedeConfirmarseDespues()
    {
        await using var db = await RecetaSqlTestDatabase.CreateAsync();
        output.WriteLine($"Base temporal: {db.DatabaseName}");
        try
        {
            await using var blocker = new SqlConnection(db.ConnectionString);
            await blocker.OpenAsync();
            using (var held = blocker.BeginTransaction(IsolationLevel.Serializable))
            {
                try
                {
                    await using var hold = new SqlCommand(
                        "SELECT COUNT(*) FROM dbo.RecetaClinica WITH (TABLOCKX, HOLDLOCK)",
                        blocker, held);
                    await hold.ExecuteScalarAsync();
                    using var factory = db.CreateFactory(new ShortLockTimeout());
                    using var client = Client(db, factory, 1, 1, 1);
                    var request = Request(1, 1, Guid.NewGuid(), [Line(1, 4)]);
                    var response = await client.PostAsJsonAsync("/api/consultas/1/recetas", request);
                    Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
                    Assert.Equal(0, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
                    held.Rollback();
                    using var normalFactory = db.CreateFactory();
                    using var normalClient = Client(db, normalFactory, 1, 1, 1);
                    Assert.Equal(HttpStatusCode.Created,
                        (await normalClient.PostAsJsonAsync("/api/consultas/1/recetas", request)).StatusCode);
                }
                finally
                {
                    if (held.Connection is not null) held.Rollback();
                }
            }
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
            Assert.Equal(1, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
        }
        finally { await db.DisposeAsync(); output.WriteLine($"Base eliminada: {db.DatabaseName}"); }
    }

    private sealed class FailBeforeCommit : DbTransactionInterceptor
    {
        public override ValueTask<InterceptionResult> TransactionCommittingAsync(
            DbTransaction transaction, TransactionEventData eventData,
            InterceptionResult result, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("Fallo sintético antes del COMMIT.");
    }

    private sealed class FailAfterCommit : DbTransactionInterceptor
    {
        public override Task TransactionCommittedAsync(
            DbTransaction transaction, TransactionEndEventData eventData,
            CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("Fallo sintético después del COMMIT.");
    }

    private sealed class CancelAfterCommit(CancellationTokenSource cancellation) : DbTransactionInterceptor
    {
        public override Task TransactionCommittedAsync(
            DbTransaction transaction, TransactionEndEventData eventData,
            CancellationToken cancellationToken = default)
        {
            cancellation.Cancel();
            throw new OperationCanceledException(cancellation.Token);
        }
    }

    private sealed class ShortLockTimeout : DbCommandInterceptor
    {
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("UPDLOCK, HOLDLOCK", StringComparison.Ordinal))
                command.CommandText = "SET LOCK_TIMEOUT 800; " + command.CommandText;
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
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
            using var anonymous = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
            Assert.Equal(HttpStatusCode.Unauthorized,
                (await anonymous.PostAsJsonAsync("/api/consultas/1/recetas", Request(1, 1, Guid.NewGuid(), [Line(1, 1)]))).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound,
                (await allowed.PostAsJsonAsync("/api/consultas/1/recetas", Request(1, 4, Guid.NewGuid(), [Line(1, 1)]))).StatusCode);
            Assert.Equal(HttpStatusCode.Conflict,
                (await allowed.PostAsJsonAsync("/api/consultas/3/recetas", Request(3, 3, Guid.NewGuid(), [Line(1, 1)]))).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden,
                (await noPermission.PostAsJsonAsync("/api/consultas/1/recetas", Request(1, 1, Guid.NewGuid(), [Line(1, 1)]))).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden,
                (await otherDoctor.PostAsJsonAsync("/api/consultas/1/recetas", Request(1, 1, Guid.NewGuid(), [Line(1, 1)]))).StatusCode);
            Assert.Equal(HttpStatusCode.Created,
                (await allowed.PostAsJsonAsync("/api/consultas/1/recetas", Request(1, 1, Guid.NewGuid(), [Line(1, 1)]))).StatusCode);
            Assert.Equal(HttpStatusCode.Created,
                (await allowed.PostAsJsonAsync("/api/consultas/2/recetas", Request(2, 2, Guid.NewGuid(), [Line(2, 2)]))).StatusCode);
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
                    Request(1, 1, Guid.NewGuid(), [Line(1, 1)]));
                Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
            }
            Assert.Equal(0, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.Tratamiento"));
            Assert.Equal(0, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaClinica"));
            Assert.Equal(0, await db.ScalarAsync("SELECT COUNT(*) FROM dbo.RecetaLinea"));
            using var normalFactory = db.CreateFactory();
            using var normal = Client(db, normalFactory, 1, 1, 1);
            var responseOk = await normal.PostAsJsonAsync("/api/consultas/1/recetas",
                Request(1, 1, Guid.NewGuid(), [Line(1, 1)]));
            Assert.Equal(HttpStatusCode.Created, responseOk.StatusCode);
            var id = JsonDocument.Parse(await responseOk.Content.ReadAsStringAsync()).RootElement.GetProperty("idReceta").GetInt32();
            var treatment = await db.ScalarAsync("SELECT IdTratamiento FROM dbo.RecetaClinica WHERE IdReceta=" + id);
            var validLine = "INSERT dbo.RecetaLinea (IdReceta,IdMedicamento,Orden,CantidadPrescritaUnidades) VALUES (" + id + ",2,2,1)";
            await AssertSqlErrorAsync(db, validLine.Replace($"VALUES ({id},2", "VALUES (999999,2"), 547); // FK
            await AssertSqlErrorAsync(db, validLine.Replace(",2,2,1)", ",2,2,0)"), 547); // CHECK
            await AssertSqlErrorAsync(db, validLine.Replace(",2,2,1)", ",2,2,-1)"), 547); // CHECK
            await AssertSqlErrorAsync(db,
                $"INSERT dbo.RecetaLinea (IdReceta,IdMedicamento,Orden,CantidadPrescritaUnidades,Dosis) VALUES ({id},2,2,1,-1)", 547);
            await AssertSqlErrorAsync(db,
                $"INSERT dbo.RecetaLinea (IdReceta,IdMedicamento,Orden,CantidadPrescritaUnidades,UnidadInventario) VALUES ({id},2,2,1,N'   ')", 547);
            await AssertSqlErrorAsync(db, validLine.Replace(",2,2,1)", ",2,1,1)"), 2627); // orden
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

    private static RecetaLineaCrearRequest Line(int medicamento, int quantity) => new()
    {
        IdMedicamento = medicamento, CantidadPrescritaUnidades = quantity
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
