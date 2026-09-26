namespace API_Clinica.Interfaces;

public interface IHabitacionEstadoNotifier
{
    Task PublicarAsync(int habitacionId, string estado);
}
