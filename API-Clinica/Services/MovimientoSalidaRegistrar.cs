using API_Clinica.Data;
using API_Clinica.Models.Entities;

namespace API_Clinica.Services;

internal static class MovimientoSalidaRegistrar
{
    private const string TipoVenta = "Venta Publica";
    private const string TipoUsoInterno = "Uso Interno";

    public static void Registrar(
        ClinicaDbContext context, int idLote, int cantidad,
        int idUsuario, int idSucursal, DateTime fecha)
        => RegistrarMovimiento(context, idLote, cantidad, idUsuario, idSucursal, fecha, TipoVenta);

    public static MovimientoInventario RegistrarUsoInterno(
        ClinicaDbContext context, int idLote, int cantidad,
        int idUsuario, int idSucursal, DateTime fecha)
        => RegistrarMovimiento(context, idLote, cantidad, idUsuario, idSucursal, fecha, TipoUsoInterno);

    private static MovimientoInventario RegistrarMovimiento(
        ClinicaDbContext context, int idLote, int cantidad,
        int idUsuario, int idSucursal, DateTime fecha, string tipo)
    {
        if (idLote <= 0 || cantidad <= 0 || idUsuario <= 0 || idSucursal <= 0)
            throw new InvalidOperationException("El movimiento de salida requiere datos válidos.");

        var movimiento = new MovimientoInventario
        {
            IdLote = idLote,
            IdUsuario = idUsuario,
            IdSucursal = idSucursal,
            TipoMovimiento = tipo,
            Cantidad = cantidad,
            FechaMovimiento = fecha
        };
        context.MovimientosInventario.Add(movimiento);
        return movimiento;
    }
}
