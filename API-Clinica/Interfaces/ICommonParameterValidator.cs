using API_Clinica.Common;

namespace API_Clinica.Interfaces;

public interface ICommonParameterValidator
{
    PaginationOptions ValidatePagination(
        int page = PaginationOptions.DefaultPage,
        int pageSize = PaginationOptions.DefaultPageSize);
}
