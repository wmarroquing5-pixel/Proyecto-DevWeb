using System.Security.Claims;
using API_Clinica.Controllers;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Tests;

public sealed class RecetasClinicasControllerTests
{
    private static readonly RecetaClinicaDetalleDto Receta = new(
        21, 17, 30, "Tratamiento sintético", null,
        new DateOnly(2026, 10, 23), new DateOnly(2026, 10, 27),
        4, "Diagnóstico sintético",
        1, "Vigente", 7, DateTime.UtcNow, []);

    [Fact]
    public async Task CrearRechazaConsultaDeRutaDiferenteAntesDePersistir()
    {
        var servicio = new ServicioFalso();
        var controller = CrearController(servicio);
        await Assert.ThrowsAsync<AppValidationException>(() => controller.Crear(
            18, new CrearRecetaClinicaRequest { IdConsulta = 17 }, CancellationToken.None));
        Assert.Equal(0, servicio.Creaciones);
    }

    [Fact]
    public async Task CrearDevuelveCreatedSoloEnPrimeraConfirmacionYOkEnReintento()
    {
        var servicio = new ServicioFalso();
        var controller = CrearController(servicio);
        var request = new CrearRecetaClinicaRequest { IdConsulta = 17 };
        var primera = await controller.Crear(17, request, CancellationToken.None);
        var created = Assert.IsType<CreatedAtActionResult>(primera.Result);
        Assert.Equal(nameof(RecetasClinicasController.Obtener), created.ActionName);
        Assert.Equal(21, created.RouteValues!["idReceta"]);
        servicio.EsReintento = true;
        var segunda = await controller.Crear(17, request, CancellationToken.None);
        Assert.IsType<OkObjectResult>(segunda.Result);
        Assert.Equal(2, servicio.Creaciones);
    }

    [Fact]
    public async Task ListadoYDetalleConservanIdentificadoresDeRuta()
    {
        var servicio = new ServicioFalso();
        var controller = CrearController(servicio);
        var listado = await controller.Listar(17, 2, 10, CancellationToken.None);
        Assert.IsType<OkObjectResult>(listado.Result);
        Assert.Equal((17, 2, 10), servicio.UltimoListado);
        var detalle = await controller.Obtener(21, CancellationToken.None);
        Assert.IsType<OkObjectResult>(detalle.Result);
        Assert.Equal(21, servicio.UltimoDetalle);
    }

    private static RecetasClinicasController CrearController(ServicioFalso servicio) => new(servicio)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim("IdUsuario", "7")], "test"))
            }
        }
    };

    private sealed class ServicioFalso : IRecetaClinicaService
    {
        public int Creaciones { get; private set; }
        public bool EsReintento { get; set; }
        public (int Consulta, int Pagina, int Tamano) UltimoListado { get; private set; }
        public int UltimoDetalle { get; private set; }

        public Task<RecetaCreacionResultado> CrearAsync(
            CrearRecetaClinicaRequest request, ClaimsPrincipal principal,
            CancellationToken cancellationToken)
        {
            Creaciones++;
            return Task.FromResult(new RecetaCreacionResultado(Receta, EsReintento));
        }

        public Task<RecetaClinicaDetalleDto> ObtenerAsync(
            int idReceta, ClaimsPrincipal principal, CancellationToken cancellationToken)
        {
            UltimoDetalle = idReceta;
            return Task.FromResult(Receta);
        }

        public Task<PagedResponse<RecetaClinicaResumenDto>> ListarPorConsultaAsync(
            int idConsulta, int page, int pageSize, ClaimsPrincipal principal,
            CancellationToken cancellationToken)
        {
            UltimoListado = (idConsulta, page, pageSize);
            return Task.FromResult(new PagedResponse<RecetaClinicaResumenDto>(
                [], page, pageSize, 0));
        }
    }
}
