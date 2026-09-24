namespace API_Clinica.DTOs;

public sealed record PagedResponse<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    long TotalCount)
{
    public long TotalPages => PageSize > 0
        ? TotalCount / PageSize + (TotalCount % PageSize > 0 ? 1 : 0)
        : 0;
}
