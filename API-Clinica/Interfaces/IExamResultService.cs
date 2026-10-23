using System.Security.Claims;
using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IExamResultService
{
    Task<IReadOnlyList<ExamResultFileDto>> ListAsync(int examId, ClaimsPrincipal user, CancellationToken ct);
    Task<IReadOnlyList<ExamResultFileDto>> UploadAsync(int examId, IReadOnlyList<IFormFile>? files,
        ClaimsPrincipal user, CancellationToken ct);
    Task<StoredExamResult> DownloadAsync(int examId, string fileId, ClaimsPrincipal user, CancellationToken ct);
    Task DeleteAsync(int examId, string fileId, ClaimsPrincipal user, CancellationToken ct);
}
