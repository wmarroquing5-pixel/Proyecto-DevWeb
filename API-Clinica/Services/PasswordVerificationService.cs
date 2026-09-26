using System.Security.Cryptography;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace API_Clinica.Services;

public sealed class PasswordVerificationService(
    IPasswordHasher<Usuario> passwordHasher,
    ILegacyPasswordVerifier legacyVerifier) : IPasswordVerificationService
{
    private static readonly string DummyHash = new PasswordHasher<Usuario>(
        Options.Create(new PasswordHasherOptions { IterationCount = 210_000 }))
        .HashPassword(new Usuario(), "verificacion-ficticia-sin-cuenta");

    public bool Verify(Usuario? usuario, string providedPassword)
    {
        if (usuario is null || string.IsNullOrEmpty(usuario.PasswordHash))
        {
            VerifyDummy(providedPassword);
            return false;
        }

        if (legacyVerifier.CanHandle(usuario.PasswordHash))
        {
            return legacyVerifier.Verify(usuario.PasswordHash, providedPassword);
        }

        try
        {
            return passwordHasher.VerifyHashedPassword(
                usuario, usuario.PasswordHash, providedPassword) != PasswordVerificationResult.Failed;
        }
        catch (FormatException)
        {
            VerifyDummy(providedPassword);
            return false;
        }
        catch (CryptographicException)
        {
            VerifyDummy(providedPassword);
            return false;
        }
    }

    private void VerifyDummy(string providedPassword) =>
        passwordHasher.VerifyHashedPassword(new Usuario(), DummyHash, providedPassword);
}
