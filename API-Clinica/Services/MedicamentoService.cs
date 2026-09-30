using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class MedicamentoService(
    ClinicaDbContext context, ICommonParameterValidator parameterValidator) : IMedicamentoService
{
    public async Task<PagedResponse<CatalogoMedicamentoResponse>> ListarCatalogoAsync(
        string? nombre, int? categoriaId, int? marcaId,
        int page, int pageSize, CancellationToken cancellationToken)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        if (categoriaId is <= 0)
            throw FarmaciaValidation.Invalid("categoriaId", "Debe ser mayor que cero.");
        if (marcaId is <= 0)
            throw FarmaciaValidation.Invalid("marcaId", "Debe ser mayor que cero.");

        var nombreFiltrado = FarmaciaValidation.OptionalText(nombre, "nombre", 150);
        var medicamentos = context.Medicamentos.AsNoTracking().Where(m => m.Activo);
        if (nombreFiltrado is not null)
        {
            var nombreNormalizado = nombreFiltrado.ToLowerInvariant();
            medicamentos = medicamentos.Where(m => m.Nombre.ToLower().Contains(nombreNormalizado));
        }
        if (categoriaId.HasValue)
            medicamentos = medicamentos.Where(m => m.IdCategoria == categoriaId.Value);
        if (marcaId.HasValue)
            medicamentos = medicamentos.Where(m => m.IdMarca == marcaId.Value);

        var total = await medicamentos.LongCountAsync(cancellationToken);
        var fechaActual = DateOnly.FromDateTime(DateTime.UtcNow);
        var pagina = medicamentos.OrderBy(m => m.IdMedicamento)
            .Skip(pagination.Skip).Take(pagination.PageSize);
        var items = await ConsultaCatalogo(pagina, fechaActual).ToListAsync(cancellationToken);
        return new(items, page, pageSize, total);
    }

    public async Task<CatalogoMedicamentoResponse> ObtenerCatalogoAsync(
        int id, CancellationToken cancellationToken)
    {
        var fechaActual = DateOnly.FromDateTime(DateTime.UtcNow);
        var medicamentos = context.Medicamentos.AsNoTracking()
            .Where(m => m.IdMedicamento == id && m.Activo);
        return await ConsultaCatalogo(medicamentos, fechaActual)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Medicamento no encontrado en el catálogo.");
    }

    private IQueryable<CatalogoMedicamentoResponse> ConsultaCatalogo(
        IQueryable<Medicamento> medicamentos, DateOnly fechaActual) =>
        from medicamento in medicamentos
        join categoria in context.Categorias.AsNoTracking()
            on medicamento.IdCategoria equals categoria.IdCategoria
        join marca in context.Marcas.AsNoTracking()
            on medicamento.IdMarca equals marca.IdMarca
        select new CatalogoMedicamentoResponse(
            medicamento.IdMedicamento, medicamento.Codigo, medicamento.Nombre,
            medicamento.PrecioVenta, marca.Nombre, categoria.Nombre,
            medicamento.Descripcion, medicamento.ImagenURL,
            context.LoteMedicamentos.AsNoTracking()
                .Where(lote => lote.IdMedicamento == medicamento.IdMedicamento &&
                    lote.FechaVencimiento > fechaActual && lote.CantidadDisponible > 0)
                .Sum(lote => (long?)lote.CantidadDisponible) ?? 0L);

    public async Task<PagedResponse<MedicamentoResponse>> ListarAsync(
        int page, int pageSize, CancellationToken cancellationToken)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        var query = context.Medicamentos.AsNoTracking();
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderBy(m => m.IdMedicamento)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(m => new MedicamentoResponse(m.IdMedicamento, m.IdCategoria,
                m.IdMarca, m.Codigo, m.Nombre, m.Descripcion, m.PrecioVenta,
                m.ImagenURL, m.Activo))
            .ToListAsync(cancellationToken);
        return new(items, page, pageSize, total);
    }

    public async Task<MedicamentoResponse> ObtenerAsync(int id, CancellationToken cancellationToken) =>
        await context.Medicamentos.AsNoTracking()
            .Where(m => m.IdMedicamento == id)
            .Select(m => new MedicamentoResponse(m.IdMedicamento, m.IdCategoria,
                m.IdMarca, m.Codigo, m.Nombre, m.Descripcion, m.PrecioVenta,
                m.ImagenURL, m.Activo))
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new NotFoundException("Medicamento no encontrado.");

    public async Task<MedicamentoResponse> CrearAsync(
        GuardarMedicamentoRequest request, CancellationToken cancellationToken)
    {
        var codigo = FarmaciaValidation.RequiredText(request.Codigo, "Codigo", 50);
        var nombre = FarmaciaValidation.RequiredText(request.Nombre, "Nombre", 150);
        var descripcion = FarmaciaValidation.OptionalText(request.Descripcion, "Descripcion", 500);
        var imagen = FarmaciaValidation.OptionalText(request.ImagenURL, "ImagenURL", 500);
        var precio = FarmaciaValidation.Price(request.PrecioVenta);
        var activo = request.Activo ?? true;
        await ValidarRelacionesAsync(request.IdCategoria, request.IdMarca, activo, cancellationToken);
        await VerificarCodigoDisponibleAsync(codigo, null, cancellationToken);

        var medicine = new Medicamento
        {
            IdCategoria = request.IdCategoria, IdMarca = request.IdMarca,
            Codigo = codigo, Nombre = nombre, Descripcion = descripcion,
            PrecioVenta = precio, ImagenURL = imagen, Activo = activo
        };
        context.Medicamentos.Add(medicine);
        await GuardarAsync(cancellationToken);
        return ToResponse(medicine);
    }

    public async Task<MedicamentoResponse> ActualizarAsync(
        int id, GuardarMedicamentoRequest request, CancellationToken cancellationToken)
    {
        var medicine = await context.Medicamentos.SingleOrDefaultAsync(
            m => m.IdMedicamento == id, cancellationToken)
            ?? throw new NotFoundException("Medicamento no encontrado.");
        var codigo = FarmaciaValidation.RequiredText(request.Codigo, "Codigo", 50);
        var nombre = FarmaciaValidation.RequiredText(request.Nombre, "Nombre", 150);
        var descripcion = FarmaciaValidation.OptionalText(request.Descripcion, "Descripcion", 500);
        var imagen = FarmaciaValidation.OptionalText(request.ImagenURL, "ImagenURL", 500);
        var precio = FarmaciaValidation.Price(request.PrecioVenta);
        var activo = request.Activo ?? medicine.Activo;
        await ValidarRelacionesAsync(request.IdCategoria, request.IdMarca, activo, cancellationToken);
        await VerificarCodigoDisponibleAsync(codigo, id, cancellationToken);

        medicine.IdCategoria = request.IdCategoria;
        medicine.IdMarca = request.IdMarca;
        medicine.Codigo = codigo;
        medicine.Nombre = nombre;
        medicine.Descripcion = descripcion;
        medicine.PrecioVenta = precio;
        medicine.ImagenURL = imagen;
        medicine.Activo = activo;
        await GuardarAsync(cancellationToken);
        return ToResponse(medicine);
    }

    public async Task DesactivarAsync(int id, CancellationToken cancellationToken)
    {
        var medicine = await context.Medicamentos.SingleOrDefaultAsync(
            m => m.IdMedicamento == id, cancellationToken)
            ?? throw new NotFoundException("Medicamento no encontrado.");
        if (!medicine.Activo) return;
        medicine.Activo = false;
        await context.SaveChangesAsync(cancellationToken);
    }

    private async Task ValidarRelacionesAsync(
        int idCategoria, int idMarca, bool activo, CancellationToken cancellationToken)
    {
        if (idCategoria <= 0 || !await context.Categorias.AsNoTracking()
            .AnyAsync(c => c.IdCategoria == idCategoria && (!activo || c.Activa), cancellationToken))
            throw FarmaciaValidation.Invalid("IdCategoria", "La categoría debe existir y estar activa para un medicamento activo.");
        if (idMarca <= 0 || !await context.Marcas.AsNoTracking()
            .AnyAsync(m => m.IdMarca == idMarca && (!activo || m.Activa), cancellationToken))
            throw FarmaciaValidation.Invalid("IdMarca", "La marca debe existir y estar activa para un medicamento activo.");
    }

    private async Task VerificarCodigoDisponibleAsync(
        string codigo, int? idActual, CancellationToken cancellationToken)
    {
        if (await context.Medicamentos.AsNoTracking()
            .AnyAsync(m => m.Codigo == codigo && m.IdMedicamento != idActual, cancellationToken))
            throw new ConflictException("El código de medicamento ya existe.");
    }

    private async Task GuardarAsync(CancellationToken cancellationToken)
    {
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 2601 or 2627)
        {
            throw new ConflictException("El código de medicamento ya existe.");
        }
    }

    private static MedicamentoResponse ToResponse(Medicamento medicine) =>
        new(medicine.IdMedicamento, medicine.IdCategoria, medicine.IdMarca,
            medicine.Codigo, medicine.Nombre, medicine.Descripcion,
            medicine.PrecioVenta, medicine.ImagenURL, medicine.Activo);
}
