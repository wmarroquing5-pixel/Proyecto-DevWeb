using API_Clinica.Interfaces;

namespace API_Clinica.Services;

public sealed class UnsupportedLegacyPasswordVerifier : ILegacyPasswordVerifier
{
    public bool CanHandle(string storedHash) => false;

    public bool Verify(string storedHash, string providedPassword) => false;
}
