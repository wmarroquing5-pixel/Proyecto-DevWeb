using Amazon.S3;
using Amazon.S3.Model;

namespace API_Clinica.R2ProductionSmokeTest;

internal interface IR2ObjectClient : IDisposable
{
    Task<ListObjectsV2Response?> ListObjectsV2Async(
        ListObjectsV2Request request,
        CancellationToken cancellationToken);

    Task<PutObjectResponse?> PutObjectAsync(
        PutObjectRequest request,
        CancellationToken cancellationToken);

    Task<GetObjectResponse?> GetObjectAsync(
        string bucketName,
        string key,
        CancellationToken cancellationToken);

    Task<GetObjectMetadataResponse?> GetObjectMetadataAsync(
        GetObjectMetadataRequest request,
        CancellationToken cancellationToken);

    Task<DeleteObjectResponse?> DeleteObjectAsync(
        DeleteObjectRequest request,
        CancellationToken cancellationToken);
}

internal sealed class AmazonR2ObjectClient(IAmazonS3 client) : IR2ObjectClient
{
    public async Task<ListObjectsV2Response?> ListObjectsV2Async(
        ListObjectsV2Request request,
        CancellationToken cancellationToken) =>
        await client.ListObjectsV2Async(request, cancellationToken);

    public async Task<PutObjectResponse?> PutObjectAsync(
        PutObjectRequest request,
        CancellationToken cancellationToken) =>
        await client.PutObjectAsync(request, cancellationToken);

    public async Task<GetObjectResponse?> GetObjectAsync(
        string bucketName,
        string key,
        CancellationToken cancellationToken) =>
        await client.GetObjectAsync(bucketName, key, cancellationToken);

    public async Task<GetObjectMetadataResponse?> GetObjectMetadataAsync(
        GetObjectMetadataRequest request,
        CancellationToken cancellationToken) =>
        await client.GetObjectMetadataAsync(request, cancellationToken);

    public async Task<DeleteObjectResponse?> DeleteObjectAsync(
        DeleteObjectRequest request,
        CancellationToken cancellationToken) =>
        await client.DeleteObjectAsync(request, cancellationToken);

    public void Dispose() => client.Dispose();
}
