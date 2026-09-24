using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Exceptions;

public sealed class GlobalExceptionHandler(
    ILogger<GlobalExceptionHandler> logger,
    IProblemDetailsService problemDetailsService) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (status, title, detail) = exception switch
        {
            NotFoundException => (StatusCodes.Status404NotFound, "Recurso no encontrado", exception.Message),
            ConflictException => (StatusCodes.Status409Conflict, "Conflicto", exception.Message),
            AppValidationException => (StatusCodes.Status400BadRequest, "Validación fallida", exception.Message),
            ForbiddenException => (StatusCodes.Status403Forbidden, "Acceso prohibido", exception.Message),
            UnauthorizedException => (StatusCodes.Status401Unauthorized, "No autorizado", exception.Message),
            BusinessRuleException => (StatusCodes.Status422UnprocessableEntity, "Regla de negocio incumplida", exception.Message),
            _ => (StatusCodes.Status500InternalServerError, "Error interno", "Ocurrió un error inesperado.")
        };

        if (status == StatusCodes.Status500InternalServerError)
        {
            logger.LogError(exception, "Error no controlado en {Path}", httpContext.Request.Path);
        }

        ProblemDetails problem = exception is AppValidationException validation
            ? new ValidationProblemDetails(validation.Errors.ToDictionary(entry => entry.Key, entry => entry.Value))
            : new ProblemDetails();

        problem.Status = status;
        problem.Title = title;
        problem.Detail = detail;
        problem.Instance = httpContext.Request.Path;

        httpContext.Response.StatusCode = status;
        await problemDetailsService.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem
        });

        return true;
    }
}
