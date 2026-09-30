using API_Clinica.Models.Entities;
using API_Clinica.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Conventions;

namespace API_Clinica.Data;

public class ClinicaDbContext(DbContextOptions<ClinicaDbContext> options) : DbContext(options)
{
    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        SaveChangesAsync(true, cancellationToken);

    public override async Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        await MedicoRegistroValidator.ValidarAsync(this, cancellationToken);
        await VentaDetalleMedicamentoValidator.ValidarAsync(this, cancellationToken);
        return await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    public override int SaveChanges() => SaveChanges(true);

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        MedicoRegistroValidator.Validar(this);
        VentaDetalleMedicamentoValidator.Validar(this);
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public DbSet<Sucursal> Sucursales => Set<Sucursal>();
    public DbSet<Especialidad> Especialidades => Set<Especialidad>();
    public DbSet<Empleado> Empleados => Set<Empleado>();
    public DbSet<Rol> Roles => Set<Rol>();
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Permiso> Permisos => Set<Permiso>();
    public DbSet<Paciente> Pacientes => Set<Paciente>();
    public DbSet<Habitacion> Habitaciones => Set<Habitacion>();
    public DbSet<AsignacionHabitacion> AsignacionesHabitacion => Set<AsignacionHabitacion>();
    public DbSet<Categoria> Categorias => Set<Categoria>();
    public DbSet<Marca> Marcas => Set<Marca>();
    public DbSet<Medicamento> Medicamentos => Set<Medicamento>();
    public DbSet<LoteMedicamento> LoteMedicamentos => Set<LoteMedicamento>();
    public DbSet<Venta> Ventas => Set<Venta>();
    public DbSet<VentaDetalle> VentaDetalles => Set<VentaDetalle>();
    public DbSet<Consulta> Consultas => Set<Consulta>();
    public DbSet<Diagnostico> Diagnosticos => Set<Diagnostico>();
    public DbSet<Examen> Examenes => Set<Examen>();
    public DbSet<Evolucion> Evoluciones => Set<Evolucion>();
    public DbSet<Tratamiento> Tratamientos => Set<Tratamiento>();
    public DbSet<Bitacora> Bitacoras => Set<Bitacora>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Conventions.Remove(typeof(ForeignKeyIndexConvention));
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Sucursal>(entity =>
        {
            entity.ToTable("Sucursal");
            entity.HasKey(e => e.IdSucursal);
            entity.Property(e => e.IdSucursal)
                .HasColumnName("IdSucursal")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.Nombre)
                .HasColumnName("Nombre")
                .HasColumnType("nvarchar(100)")
                .HasMaxLength(100)
                .IsRequired(true);
            entity.Property(e => e.Direccion)
                .HasColumnName("Direccion")
                .HasColumnType("nvarchar(255)")
                .HasMaxLength(255)
                .IsRequired(false);
            entity.Property(e => e.Activa)
                .HasColumnName("Activa")
                .HasColumnType("bit")
                .IsRequired(true)
                .HasDefaultValue(true);
        });

        modelBuilder.Entity<Especialidad>(entity =>
        {
            entity.ToTable("Especialidad");
            entity.HasKey(e => e.IdEspecialidad);
            entity.Property(e => e.IdEspecialidad)
                .HasColumnName("IdEspecialidad")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.Nombre)
                .HasColumnName("Nombre")
                .HasColumnType("nvarchar(100)")
                .HasMaxLength(100)
                .IsRequired(true);
            entity.Property(e => e.Activa)
                .HasColumnName("Activa")
                .HasColumnType("bit")
                .IsRequired(true)
                .HasDefaultValue(true);
            entity.HasIndex(e => e.Nombre).IsUnique();
        });

        modelBuilder.Entity<Empleado>(entity =>
        {
            entity.ToTable("Empleado", table =>
            {
                table.HasCheckConstraint("CHK_Empleado_Tipo", "(TipoEmpleado IN ('Medico', 'Enfermera', 'Administrativo'))");
            });
            entity.HasKey(e => e.IdEmpleado);
            entity.Property(e => e.IdEmpleado)
                .HasColumnName("IdEmpleado")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.IdSucursal)
                .HasColumnName("IdSucursal")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.IdEspecialidad)
                .HasColumnName("IdEspecialidad")
                .HasColumnType("int")
                .IsRequired(false);
            entity.Property(e => e.Nombres)
                .HasColumnName("Nombres")
                .HasColumnType("nvarchar(100)")
                .HasMaxLength(100)
                .IsRequired(true);
            entity.Property(e => e.Apellidos)
                .HasColumnName("Apellidos")
                .HasColumnType("nvarchar(100)")
                .HasMaxLength(100)
                .IsRequired(true);
            entity.Property(e => e.DPI)
                .HasColumnName("DPI")
                .HasColumnType("nvarchar(20)")
                .HasMaxLength(20)
                .IsRequired(true);
            entity.Property(e => e.TipoEmpleado)
                .HasColumnName("TipoEmpleado")
                .HasColumnType("nvarchar(30)")
                .HasMaxLength(30)
                .IsRequired(true);
            entity.Property(e => e.Activo)
                .HasColumnName("Activo")
                .HasColumnType("bit")
                .IsRequired(true)
                .HasDefaultValue(true);
            entity.HasAlternateKey(e => e.DPI);
            entity.HasOne<Sucursal>()
                .WithMany()
                .HasForeignKey(e => e.IdSucursal)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Empleado_Sucursal");
            entity.HasOne<Especialidad>()
                .WithMany()
                .HasForeignKey(e => e.IdEspecialidad)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Empleado_Especialidad");
        });

        modelBuilder.Entity<Rol>(entity =>
        {
            entity.ToTable("Rol");
            entity.HasKey(e => e.IdRol);
            entity.Property(e => e.IdRol)
                .HasColumnName("IdRol")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.Nombre)
                .HasColumnName("Nombre")
                .HasColumnType("nvarchar(50)")
                .HasMaxLength(50)
                .IsRequired(true);
            entity.Property(e => e.Activo)
                .HasColumnName("Activo")
                .HasColumnType("bit")
                .IsRequired(true)
                .HasDefaultValue(true);
            entity.HasAlternateKey(e => e.Nombre);
        });

        modelBuilder.Entity<Usuario>(entity =>
        {
            entity.ToTable("Usuario");
            entity.HasKey(e => e.IdUsuario);
            entity.Property(e => e.IdUsuario)
                .HasColumnName("IdUsuario")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.IdRol)
                .HasColumnName("IdRol")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.IdEmpleado)
                .HasColumnName("IdEmpleado")
                .HasColumnType("int")
                .IsRequired(false);
            entity.Property(e => e.Username)
                .HasColumnName("Username")
                .HasColumnType("nvarchar(50)")
                .HasMaxLength(50)
                .IsRequired(true);
            entity.Property(e => e.PasswordHash)
                .HasColumnName("PasswordHash")
                .HasColumnType("nvarchar(max)")
                .IsRequired(true);
            entity.Property(e => e.Activo)
                .HasColumnName("Activo")
                .HasColumnType("bit")
                .IsRequired(true)
                .HasDefaultValue(true);
            entity.HasAlternateKey(e => e.Username);
            entity.HasOne<Rol>()
                .WithMany()
                .HasForeignKey(e => e.IdRol)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Usuario_Rol");
            entity.HasOne<Empleado>()
                .WithMany()
                .HasForeignKey(e => e.IdEmpleado)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Usuario_Empleado");
        });

        modelBuilder.Entity<Permiso>(entity =>
        {
            entity.ToTable("Permiso");
            entity.HasKey(e => e.IdPermiso);
            entity.Property(e => e.IdPermiso)
                .HasColumnName("IdPermiso")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.IdRol)
                .HasColumnName("IdRol")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.Modulo)
                .HasColumnName("Modulo")
                .HasColumnType("nvarchar(50)")
                .HasMaxLength(50)
                .IsRequired(true);
            entity.Property(e => e.PuedeConsultar)
                .HasColumnName("PuedeConsultar")
                .HasColumnType("bit")
                .IsRequired(true)
                .HasDefaultValue(false);
            entity.Property(e => e.PuedeCrear)
                .HasColumnName("PuedeCrear")
                .HasColumnType("bit")
                .IsRequired(true)
                .HasDefaultValue(false);
            entity.Property(e => e.PuedeModificar)
                .HasColumnName("PuedeModificar")
                .HasColumnType("bit")
                .IsRequired(true)
                .HasDefaultValue(false);
            entity.Property(e => e.PuedeEliminar)
                .HasColumnName("PuedeEliminar")
                .HasColumnType("bit")
                .IsRequired(true)
                .HasDefaultValue(false);
            entity.HasOne<Rol>()
                .WithMany()
                .HasForeignKey(e => e.IdRol)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Permiso_Rol");
        });

        modelBuilder.Entity<Paciente>(entity =>
        {
            entity.ToTable("Paciente");
            entity.HasKey(e => e.IdPaciente);
            entity.Property(e => e.IdPaciente)
                .HasColumnName("IdPaciente")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.Nombres)
                .HasColumnName("Nombres")
                .HasColumnType("nvarchar(100)")
                .HasMaxLength(100)
                .IsRequired(true);
            entity.Property(e => e.Apellidos)
                .HasColumnName("Apellidos")
                .HasColumnType("nvarchar(100)")
                .HasMaxLength(100)
                .IsRequired(true);
            entity.Property(e => e.DPI)
                .HasColumnName("DPI")
                .HasColumnType("nvarchar(20)")
                .HasMaxLength(20)
                .IsRequired(false);
            entity.Property(e => e.FechaNacimiento)
                .HasColumnName("FechaNacimiento")
                .HasColumnType("date")
                .IsRequired(true);
            entity.Property(e => e.Sexo)
                .HasColumnName("Sexo")
                .HasColumnType("nvarchar(15)")
                .HasMaxLength(15)
                .IsRequired(false);
            entity.Property(e => e.Telefono)
                .HasColumnName("Telefono")
                .HasColumnType("nvarchar(20)")
                .HasMaxLength(20)
                .IsRequired(false);
            entity.Property(e => e.Correo)
                .HasColumnName("Correo")
                .HasColumnType("nvarchar(100)")
                .HasMaxLength(100)
                .IsRequired(false);
            entity.Property(e => e.FechaRegistro)
                .HasColumnName("FechaRegistro")
                .HasColumnType("datetime2")
                .IsRequired(true)
                .HasDefaultValueSql("SYSUTCDATETIME()");
            entity.Property(e => e.Activo)
                .HasColumnName("Activo")
                .HasColumnType("bit")
                .IsRequired(true)
                .HasDefaultValue(true);
        });

        modelBuilder.Entity<Habitacion>(entity =>
        {
            entity.ToTable("Habitacion", table =>
            {
                table.HasCheckConstraint("CHK_Habitacion_Estado", "(Estado IN ('Libre', 'Ocupada', 'En limpieza'))");
            });
            entity.HasKey(e => e.IdHabitacion);
            entity.Property(e => e.IdHabitacion)
                .HasColumnName("IdHabitacion")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.IdSucursal)
                .HasColumnName("IdSucursal")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.NumeroHabitacion)
                .HasColumnName("NumeroHabitacion")
                .HasColumnType("nvarchar(20)")
                .HasMaxLength(20)
                .IsRequired(true);
            entity.Property(e => e.TipoHabitacion)
                .HasColumnName("TipoHabitacion")
                .HasColumnType("nvarchar(50)")
                .HasMaxLength(50)
                .IsRequired(false);
            entity.Property(e => e.Estado)
                .HasColumnName("Estado")
                .HasColumnType("nvarchar(20)")
                .HasMaxLength(20)
                .IsRequired(true);
            entity.Property(e => e.Activa)
                .HasColumnName("Activa")
                .HasColumnType("bit")
                .IsRequired(true)
                .HasDefaultValue(true);
            entity.HasOne<Sucursal>()
                .WithMany()
                .HasForeignKey(e => e.IdSucursal)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Habitacion_Sucursal");
        });

        modelBuilder.Entity<AsignacionHabitacion>(entity =>
        {
            entity.ToTable("AsignacionHabitacion");
            entity.HasKey(e => e.IdAsignacion);
            entity.Property(e => e.IdAsignacion)
                .HasColumnName("IdAsignacion")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.IdHabitacion)
                .HasColumnName("IdHabitacion")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.IdPaciente)
                .HasColumnName("IdPaciente")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.FechaIngreso)
                .HasColumnName("FechaIngreso")
                .HasColumnType("datetime2")
                .IsRequired(true);
            entity.Property(e => e.FechaEgreso)
                .HasColumnName("FechaEgreso")
                .HasColumnType("datetime2")
                .IsRequired(false);
            entity.Property(e => e.Observaciones)
                .HasColumnName("Observaciones")
                .HasColumnType("nvarchar(max)")
                .IsRequired(false);
            entity.HasOne<Habitacion>()
                .WithMany()
                .HasForeignKey(e => e.IdHabitacion)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Asignacion_Habitacion");
            entity.HasOne<Paciente>()
                .WithMany()
                .HasForeignKey(e => e.IdPaciente)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Asignacion_Paciente");
        });

        modelBuilder.Entity<Categoria>(entity =>
        {
            entity.ToTable("Categoria");
            entity.HasKey(e => e.IdCategoria);
            entity.Property(e => e.IdCategoria)
                .HasColumnName("IdCategoria")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.Nombre)
                .HasColumnName("Nombre")
                .HasColumnType("nvarchar(100)")
                .HasMaxLength(100)
                .IsRequired(true);
            entity.Property(e => e.Activa)
                .HasColumnName("Activa")
                .HasColumnType("bit")
                .IsRequired(true)
                .HasDefaultValue(true);
        });

        modelBuilder.Entity<Marca>(entity =>
        {
            entity.ToTable("Marca");
            entity.HasKey(e => e.IdMarca);
            entity.Property(e => e.IdMarca)
                .HasColumnName("IdMarca")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.Nombre)
                .HasColumnName("Nombre")
                .HasColumnType("nvarchar(100)")
                .HasMaxLength(100)
                .IsRequired(true);
            entity.Property(e => e.Activa)
                .HasColumnName("Activa")
                .HasColumnType("bit")
                .IsRequired(true)
                .HasDefaultValue(true);
        });

        modelBuilder.Entity<Medicamento>(entity =>
        {
            entity.ToTable("Medicamento", table =>
            {
                table.HasCheckConstraint("CHK_Medicamento_Precio", "(PrecioVenta > 0)");
            });
            entity.HasKey(e => e.IdMedicamento);
            entity.Property(e => e.IdMedicamento)
                .HasColumnName("IdMedicamento")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.IdCategoria)
                .HasColumnName("IdCategoria")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.IdMarca)
                .HasColumnName("IdMarca")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.Codigo)
                .HasColumnName("Codigo")
                .HasColumnType("nvarchar(50)")
                .HasMaxLength(50)
                .IsRequired(true);
            entity.Property(e => e.Nombre)
                .HasColumnName("Nombre")
                .HasColumnType("nvarchar(150)")
                .HasMaxLength(150)
                .IsRequired(true);
            entity.Property(e => e.Descripcion)
                .HasColumnName("Descripcion")
                .HasColumnType("nvarchar(500)")
                .HasMaxLength(500)
                .IsRequired(false);
            entity.Property(e => e.PrecioVenta)
                .HasColumnName("PrecioVenta")
                .HasColumnType("decimal(18,2)")
                .IsRequired(true);
            entity.Property(e => e.ImagenURL)
                .HasColumnName("ImagenURL")
                .HasColumnType("nvarchar(500)")
                .HasMaxLength(500)
                .IsRequired(false);
            entity.Property(e => e.Activo)
                .HasColumnName("Activo")
                .HasColumnType("bit")
                .IsRequired(true)
                .HasDefaultValue(true);
            entity.HasAlternateKey(e => e.Codigo);
            entity.HasOne<Categoria>()
                .WithMany()
                .HasForeignKey(e => e.IdCategoria)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Medicamento_Categoria");
            entity.HasOne<Marca>()
                .WithMany()
                .HasForeignKey(e => e.IdMarca)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Medicamento_Marca");
        });

        modelBuilder.Entity<LoteMedicamento>(entity =>
        {
            entity.ToTable("LoteMedicamento", table =>
            {
                table.HasCheckConstraint("CHK_Lote_Cantidad", "(CantidadDisponible >= 0)");
            });
            entity.HasKey(e => e.IdLote);
            entity.Property(e => e.IdLote)
                .HasColumnName("IdLote")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.IdMedicamento)
                .HasColumnName("IdMedicamento")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.NumeroLote)
                .HasColumnName("NumeroLote")
                .HasColumnType("nvarchar(50)")
                .HasMaxLength(50)
                .IsRequired(true);
            entity.Property(e => e.FechaIngreso)
                .HasColumnName("FechaIngreso")
                .HasColumnType("date")
                .IsRequired(true);
            entity.Property(e => e.FechaVencimiento)
                .HasColumnName("FechaVencimiento")
                .HasColumnType("date")
                .IsRequired(true);
            entity.Property(e => e.CantidadDisponible)
                .HasColumnName("CantidadDisponible")
                .HasColumnType("int")
                .IsRequired(true)
                .IsConcurrencyToken();
            entity.HasOne<Medicamento>()
                .WithMany()
                .HasForeignKey(e => e.IdMedicamento)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Lote_Medicamento");
        });

        modelBuilder.Entity<Venta>(entity =>
        {
            entity.ToTable("Venta", table =>
            {
                table.HasCheckConstraint("CHK_Venta_Total", "(Total > 0)");
            });
            entity.HasKey(e => e.IdVenta);
            entity.Property(e => e.IdVenta)
                .HasColumnName("IdVenta")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.IdUsuario)
                .HasColumnName("IdUsuario")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.IdSucursal)
                .HasColumnName("IdSucursal")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.FechaVenta)
                .HasColumnName("FechaVenta")
                .HasColumnType("datetime2")
                .IsRequired(true)
                .HasDefaultValueSql("SYSUTCDATETIME()");
            entity.Property(e => e.Total)
                .HasColumnName("Total")
                .HasColumnType("decimal(18,2)")
                .IsRequired(true);
            entity.HasOne<Usuario>()
                .WithMany()
                .HasForeignKey(e => e.IdUsuario)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Venta_Usuario");
            entity.HasOne<Sucursal>()
                .WithMany()
                .HasForeignKey(e => e.IdSucursal)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Venta_Sucursal");
        });

        modelBuilder.Entity<VentaDetalle>(entity =>
        {
            entity.ToTable("VentaDetalle", table =>
            {
                table.HasCheckConstraint("CHK_VentaDetalle_Cantidad", "(Cantidad > 0)");
                table.HasCheckConstraint("CHK_VentaDetalle_Precio", "(PrecioUnitario > 0)");
                table.HasCheckConstraint("CHK_VentaDetalle_Subtotal", "(Subtotal > 0)");
            });
            entity.HasKey(e => e.IdVentaDetalle);
            entity.Property(e => e.IdVentaDetalle)
                .HasColumnName("IdVentaDetalle")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.IdVenta)
                .HasColumnName("IdVenta")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.IdLote)
                .HasColumnName("IdLote")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.Cantidad)
                .HasColumnName("Cantidad")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.PrecioUnitario)
                .HasColumnName("PrecioUnitario")
                .HasColumnType("decimal(18,2)")
                .IsRequired(true);
            entity.Property(e => e.Subtotal)
                .HasColumnName("Subtotal")
                .HasColumnType("decimal(18,2)")
                .IsRequired(true);
            entity.HasOne(e => e.Venta)
                .WithMany()
                .HasForeignKey(e => e.IdVenta)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Detalle_Venta");
            entity.HasOne<LoteMedicamento>()
                .WithMany()
                .HasForeignKey(e => e.IdLote)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Detalle_Lote");
        });

        modelBuilder.Entity<Consulta>(entity =>
        {
            entity.ToTable("Consulta");
            entity.HasKey(e => e.IdConsulta);
            entity.Property(e => e.IdConsulta)
                .HasColumnName("IdConsulta")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.IdPaciente)
                .HasColumnName("IdPaciente")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.IdMedico)
                .HasColumnName("IdMedico")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.IdSucursal)
                .HasColumnName("IdSucursal")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.FechaConsulta)
                .HasColumnName("FechaConsulta")
                .HasColumnType("datetime2")
                .IsRequired(true);
            entity.Property(e => e.MotivoConsulta)
                .HasColumnName("MotivoConsulta")
                .HasColumnType("nvarchar(max)")
                .IsRequired(false);
            entity.Property(e => e.Sintomas)
                .HasColumnName("Sintomas")
                .HasColumnType("nvarchar(max)")
                .IsRequired(false);
            entity.Property(e => e.Observaciones)
                .HasColumnName("Observaciones")
                .HasColumnType("nvarchar(max)")
                .IsRequired(false);
            entity.HasOne<Paciente>()
                .WithMany()
                .HasForeignKey(e => e.IdPaciente)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Consulta_Paciente");
            entity.HasOne<Empleado>()
                .WithMany()
                .HasForeignKey(e => e.IdMedico)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Consulta_Medico");
            entity.HasOne<Sucursal>()
                .WithMany()
                .HasForeignKey(e => e.IdSucursal)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Consulta_Sucursal");
        });

        modelBuilder.Entity<Diagnostico>(entity =>
        {
            entity.ToTable("Diagnostico");
            entity.HasKey(e => e.IdDiagnostico);
            entity.Property(e => e.IdDiagnostico)
                .HasColumnName("IdDiagnostico")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.IdConsulta)
                .HasColumnName("IdConsulta")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.IdMedico)
                .HasColumnName("IdMedico")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.Descripcion)
                .HasColumnName("Descripcion")
                .HasColumnType("nvarchar(max)")
                .IsRequired(true);
            entity.Property(e => e.FechaRegistro)
                .HasColumnName("FechaRegistro")
                .HasColumnType("datetime2")
                .IsRequired(true)
                .HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasOne<Consulta>()
                .WithMany()
                .HasForeignKey(e => e.IdConsulta)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Diagnostico_Consulta");
            entity.HasOne<Empleado>()
                .WithMany()
                .HasForeignKey(e => e.IdMedico)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Diagnostico_Medico");
        });

        modelBuilder.Entity<Examen>(entity =>
        {
            entity.ToTable("Examen");
            entity.HasKey(e => e.IdExamen);
            entity.Property(e => e.IdExamen)
                .HasColumnName("IdExamen")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.IdPaciente)
                .HasColumnName("IdPaciente")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.IdConsulta)
                .HasColumnName("IdConsulta")
                .HasColumnType("int")
                .IsRequired(false);
            entity.Property(e => e.IdMedico)
                .HasColumnName("IdMedico")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.NombreExamen)
                .HasColumnName("NombreExamen")
                .HasColumnType("nvarchar(200)")
                .HasMaxLength(200)
                .IsRequired(true);
            entity.Property(e => e.FechaExamen)
                .HasColumnName("FechaExamen")
                .HasColumnType("datetime2")
                .IsRequired(true);
            entity.Property(e => e.Resultado)
                .HasColumnName("Resultado")
                .HasColumnType("nvarchar(max)")
                .IsRequired(false);
            entity.HasOne<Paciente>()
                .WithMany()
                .HasForeignKey(e => e.IdPaciente)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Examen_Paciente");
            entity.HasOne<Consulta>()
                .WithMany()
                .HasForeignKey(e => e.IdConsulta)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Examen_Consulta");
            entity.HasOne<Empleado>()
                .WithMany()
                .HasForeignKey(e => e.IdMedico)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Examen_Medico");
        });

        modelBuilder.Entity<Evolucion>(entity =>
        {
            entity.ToTable("Evolucion");
            entity.HasKey(e => e.IdEvolucion);
            entity.Property(e => e.IdEvolucion)
                .HasColumnName("IdEvolucion")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.IdPaciente)
                .HasColumnName("IdPaciente")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.IdConsulta)
                .HasColumnName("IdConsulta")
                .HasColumnType("int")
                .IsRequired(false);
            entity.Property(e => e.IdMedico)
                .HasColumnName("IdMedico")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.FechaEvolucion)
                .HasColumnName("FechaEvolucion")
                .HasColumnType("datetime2")
                .IsRequired(true);
            entity.Property(e => e.Descripcion)
                .HasColumnName("Descripcion")
                .HasColumnType("nvarchar(max)")
                .IsRequired(true);
            entity.HasOne<Paciente>()
                .WithMany()
                .HasForeignKey(e => e.IdPaciente)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Evolucion_Paciente");
            entity.HasOne<Consulta>()
                .WithMany()
                .HasForeignKey(e => e.IdConsulta)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Evolucion_Consulta");
            entity.HasOne<Empleado>()
                .WithMany()
                .HasForeignKey(e => e.IdMedico)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Evolucion_Medico");
        });

        modelBuilder.Entity<Tratamiento>(entity =>
        {
            entity.ToTable("Tratamiento");
            entity.HasKey(e => e.IdTratamiento);
            entity.Property(e => e.IdTratamiento)
                .HasColumnName("IdTratamiento")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.IdConsulta)
                .HasColumnName("IdConsulta")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.IdMedico)
                .HasColumnName("IdMedico")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.Descripcion)
                .HasColumnName("Descripcion")
                .HasColumnType("nvarchar(max)")
                .IsRequired(true);
            entity.Property(e => e.Indicaciones)
                .HasColumnName("Indicaciones")
                .HasColumnType("nvarchar(max)")
                .IsRequired(false);
            entity.Property(e => e.FechaInicio)
                .HasColumnName("FechaInicio")
                .HasColumnType("date")
                .IsRequired(true);
            entity.Property(e => e.FechaFin)
                .HasColumnName("FechaFin")
                .HasColumnType("date")
                .IsRequired(false);
            entity.HasOne<Consulta>()
                .WithMany()
                .HasForeignKey(e => e.IdConsulta)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Tratamiento_Consulta");
            entity.HasOne<Empleado>()
                .WithMany()
                .HasForeignKey(e => e.IdMedico)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Tratamiento_Medico");
        });

        modelBuilder.Entity<Bitacora>(entity =>
        {
            entity.ToTable("Bitacora");
            entity.HasKey(e => e.IdBitacora);
            entity.Property(e => e.IdBitacora)
                .HasColumnName("IdBitacora")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.IdUsuario)
                .HasColumnName("IdUsuario")
                .HasColumnType("int")
                .IsRequired(false);
            entity.Property(e => e.TablaAfectada)
                .HasColumnName("TablaAfectada")
                .HasColumnType("nvarchar(100)")
                .HasMaxLength(100)
                .IsRequired(true);
            entity.Property(e => e.Accion)
                .HasColumnName("Accion")
                .HasColumnType("nvarchar(20)")
                .HasMaxLength(20)
                .IsRequired(true);
            entity.Property(e => e.RegistroId)
                .HasColumnName("RegistroId")
                .HasColumnType("nvarchar(50)")
                .HasMaxLength(50)
                .IsRequired(true);
            entity.Property(e => e.ValoresAnteriores)
                .HasColumnName("ValoresAnteriores")
                .HasColumnType("nvarchar(max)")
                .IsRequired(false);
            entity.Property(e => e.ValoresNuevos)
                .HasColumnName("ValoresNuevos")
                .HasColumnType("nvarchar(max)")
                .IsRequired(false);
            entity.Property(e => e.Fecha)
                .HasColumnName("Fecha")
                .HasColumnType("datetime2")
                .IsRequired(true)
                .HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasOne<Usuario>()
                .WithMany()
                .HasForeignKey(e => e.IdUsuario)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Bitacora_Usuario");
            entity.HasIndex(e => new { e.TablaAfectada, e.Fecha }, "IX_Bitacora_Tabla_Fecha");
        });

    }
}
