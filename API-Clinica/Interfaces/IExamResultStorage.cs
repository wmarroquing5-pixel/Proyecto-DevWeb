using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public sealed record StoredExamResult(ExamResultFileDto Metadata, byte[] Content, string EntityTag);

public interface IExamResultStorage
{
    Task<IReadOnlyList<ExamResultFileDto>> ListAsync(int examId, CancellationToken ct);
    Task<ExamResultFileDto> SaveAsync(int examId, string fileId, byte[] content,
        string contentType, string originalName, int userId, DateTimeOffset uploadedAt,
        CancellationToken ct);
    Task<StoredExamResult?> GetAsync(int examId, string fileId, CancellationToken ct);
    Task DeleteAsync(int examId, string fileId, string expectedEntityTag, CancellationToken ct);
}
