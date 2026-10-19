using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public sealed record StoredPhoto(byte[] Content, string ContentType, string EntityTag);

public sealed record PhotoWriteCondition(bool MustNotExist, string? ExpectedEntityTag)
{
    public static PhotoWriteCondition ForNewObject { get; } = new(true, null);

    public static PhotoWriteCondition ForReplacement(string entityTag) =>
        new(false, entityTag);
}

public interface IPhotoStorageService
{
    Task<StoredPhoto?> GetAsync(string key, CancellationToken cancellationToken);

    Task<string> SaveAsync(
        string key,
        ProcessedPhoto photo,
        PhotoWriteCondition condition,
        CancellationToken cancellationToken);

    Task DeleteAsync(
        string key,
        string expectedEntityTag,
        CancellationToken cancellationToken);
}
