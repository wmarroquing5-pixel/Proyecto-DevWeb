namespace API_Clinica.Interfaces;

public interface ILegacyPasswordVerifier
{
    bool CanHandle(string storedHash);

    bool Verify(string storedHash, string providedPassword);
}
