using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IPhotoImageProcessor
{
    Task<ProcessedPhoto> ProcessAsync(IFormFile? file, CancellationToken cancellationToken);
}
