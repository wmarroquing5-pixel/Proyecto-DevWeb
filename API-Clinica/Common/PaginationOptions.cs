namespace API_Clinica.Common;

public readonly record struct PaginationOptions(int Page, int PageSize)
{
    public const int DefaultPage = 1;
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public int Skip => checked((Page - 1) * PageSize);
}
