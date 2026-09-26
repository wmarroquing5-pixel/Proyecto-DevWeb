using API_Clinica.Models.Entities;

namespace API_Clinica.Interfaces;

public interface IPasswordVerificationService
{
    bool Verify(Usuario? usuario, string providedPassword);
}
