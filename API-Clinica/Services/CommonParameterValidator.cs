using API_Clinica.Common;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;

namespace API_Clinica.Services;

public sealed class CommonParameterValidator : ICommonParameterValidator
{
    public PaginationOptions ValidatePagination(int page, int pageSize)
    {
        var errors = new Dictionary<string, string[]>();

        if (page < 1)
        {
            errors[nameof(page)] = ["Debe ser mayor o igual a 1."];
        }

        if (pageSize is < 1 or > PaginationOptions.MaxPageSize)
        {
            errors[nameof(pageSize)] = [$"Debe estar entre 1 y {PaginationOptions.MaxPageSize}."];
        }

        if (errors.Count == 0 && ((long)page - 1) * pageSize > int.MaxValue)
        {
            errors[nameof(page)] = ["La página solicitada excede el rango permitido."];
        }

        if (errors.Count > 0)
        {
            throw new AppValidationException("Los parámetros de paginación no son válidos.", errors);
        }

        return new PaginationOptions(page, pageSize);
    }
}
