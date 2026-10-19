using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IPhotoService
{
    Task<PhotoResponse> SavePatientPhotoAsync(
        int patientId, IFormFile? file, CancellationToken cancellationToken);

    Task<PhotoContent> GetPatientPhotoAsync(
        int patientId, CancellationToken cancellationToken);

    Task DeletePatientPhotoAsync(
        int patientId, CancellationToken cancellationToken);

    Task<PhotoResponse> SaveMedicinePhotoAsync(
        int medicineId, IFormFile? file, CancellationToken cancellationToken);

    Task<PhotoContent> GetMedicinePhotoAsync(
        int medicineId, CancellationToken cancellationToken);

    Task DeleteMedicinePhotoAsync(
        int medicineId, CancellationToken cancellationToken);
}
