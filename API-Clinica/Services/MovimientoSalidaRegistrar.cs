using API_Clinica.Data;
using API_Clinica.Models.Entities;

namespace API_Clinica.Services;

internal static class MovimientoSalidaRegistrar
{
    private const string TipoVenta = "Venta Publica";

    public static void Registrar(
        ClinicaDbContext context, int idLote, int cantidad,
        int idUsuario, int idSucursal, DateTime fecha)
    {
        if (idLote <= 0 || cantidad <= 0 || idUsuario <= 0 || idSucursal <= 0)
            throw new InvalidOperationException("El movimiento de salida requiere datos válidos.");

        context.MovimientosInventario.Add(new MovimientoInventario
        {
            IdLote = idLote,
            IdUsuario = idUsuario,
            IdSucursal = idSucursal,
            TipoMovimiento = TipoVenta,
            Cantidad = cantidad,
            FechaMovimiento = fecha
        });
    }
}
