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
    public DbSet<Clinica> Clinicas => Set<Clinica>();
    public DbSet<ContactoEmergencia> ContactosEmergencia => Set<ContactoEmergencia>();
    public DbSet<MovimientoInventario> MovimientosInventario => Set<MovimientoInventario>();
    public DbSet<Servicio> Servicios => Set<Servicio>();
    public DbSet<Turno> Turnos => Set<Turno>();
    // Los contratos de ventas e historial conservan sus nombres CLR y rutas actuales.
    public DbSet<Venta> Facturas => Set<Venta>();
    public DbSet<VentaDetalle> FacturaDetalles => Set<VentaDetalle>();
    public DbSet<Evolucion> HistorialesMedicos => Set<Evolucion>();

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
            entity.Property<string?>("Telefono").HasColumnType("nvarchar(12)");
            entity.Property<string?>("CorreoElectronico").HasColumnType("nvarchar(75)");
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
            entity.HasIndex(e => e.DPI).IsUnique();
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
            entity.Property(e => e.IdTurno).HasColumnType("int");
            entity.Property(e => e.FechaIngreso).HasColumnType("date");
            entity.Property(e => e.TipoSangre).HasColumnType("nvarchar(10)");
            entity.Property(e => e.Direccion).HasColumnType("nvarchar(150)");
            entity.Property(e => e.Telefono).HasColumnType("nvarchar(12)");
            entity.Property(e => e.CorreoElectronico).HasColumnType("nvarchar(150)");
            entity.HasOne<Turno>().WithMany().HasForeignKey(e => e.IdTurno)
                .OnDelete(DeleteBehavior.NoAction).HasConstraintName("FK_Empleado_Turno");
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
                .HasColumnName("Genero")
                .HasColumnType("nvarchar(1)")
                .HasMaxLength(1)
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
            entity.Property(e => e.Nit).HasColumnType("nvarchar(50)");
            entity.Property(e => e.NombreFacturacion).HasColumnType("nvarchar(150)");
            entity.Property(e => e.Direccion).HasColumnType("nvarchar(150)");
            entity.Property(e => e.UrlFoto).HasColumnType("nvarchar(500)");
            entity.Property(e => e.TipoSangre).HasColumnType("nvarchar(10)");
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
                .HasColumnType("nvarchar(300)")
                .IsRequired(false);
            entity.Property(e => e.TipoAsignacion).HasColumnType("nvarchar(20)")
                .HasDefaultValue("Paciente").IsRequired();
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
            entity.Property<string?>("Presentacion").HasColumnType("nvarchar(100)");
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
            entity.ToTable("Factura", table =>
            {
                table.HasCheckConstraint("CHK_Factura_Tipo", "([TipoFactura]='Estancia Medica' OR [TipoFactura]='Venta Publica')");
                table.HasCheckConstraint("CHK_Venta_Total", "([Total]>(0))");
            });
            entity.HasKey(e => e.IdVenta);
            entity.Property(e => e.IdVenta)
                .HasColumnName("IdFactura")
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
                .HasColumnName("FechaFactura")
                .HasColumnType("datetime2")
                .IsRequired(true)
                .HasDefaultValueSql("SYSUTCDATETIME()");
            entity.Property(e => e.Total)
                .HasColumnName("Total")
                .HasColumnType("decimal(18,2)")
                .IsRequired(true);
            entity.Property<int?>("IdPaciente").HasColumnType("int");
            entity.Property<string?>("Nit").HasColumnType("nvarchar(50)");
            entity.Property<string?>("NombreFacturacion").HasColumnType("nvarchar(150)");
            entity.Property(e => e.TipoFactura).HasColumnType("nvarchar(30)")
                .HasDefaultValue("Venta Publica").IsRequired();
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
            entity.HasOne<Paciente>().WithMany().HasForeignKey("IdPaciente")
                .OnDelete(DeleteBehavior.NoAction).HasConstraintName("FK_Factura_Paciente");
        });

        modelBuilder.Entity<VentaDetalle>(entity =>
        {
            entity.ToTable("FacturaDetalle", table =>
            {
                table.HasCheckConstraint("CHK_Detalle_Producto_O_Servicio", "([IdLote] IS NOT NULL AND [IdServicio] IS NULL OR [IdLote] IS NULL AND [IdServicio] IS NOT NULL)");
                table.HasCheckConstraint("CHK_VentaDetalle_Cantidad", "([Cantidad]>(0))");
                table.HasCheckConstraint("CHK_VentaDetalle_Precio", "([PrecioUnitario]>(0))");
                table.HasCheckConstraint("CHK_VentaDetalle_Subtotal", "([Subtotal]>(0))");
            });
            entity.HasKey(e => e.IdVentaDetalle);
            entity.Property(e => e.IdVentaDetalle)
                .HasColumnName("IdDetalle")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Property(e => e.IdVenta)
                .HasColumnName("IdFactura")
                .HasColumnType("int")
                .IsRequired(true);
            entity.Property(e => e.IdLote)
                .HasColumnName("IdLote")
                .HasColumnType("int")
                .IsRequired(false);
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
            entity.Property<int?>("IdServicio").HasColumnType("int");
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
            entity.HasOne<Servicio>().WithMany().HasForeignKey("IdServicio")
                .OnDelete(DeleteBehavior.NoAction).HasConstraintName("FK_Detalle_Servicio");
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
                .HasColumnType("nvarchar(300)")
                .IsRequired(false);
            entity.Property(e => e.Sintomas)
                .HasColumnName("Sintomas")
                .HasColumnType("nvarchar(300)")
                .IsRequired(false);
            entity.Property(e => e.Observaciones)
                .HasColumnName("Observaciones")
                .HasColumnType("nvarchar(300)")
                .IsRequired(false);
            entity.Property(e => e.IdClinica).HasColumnType("int");
            entity.Property(e => e.PesoLb).HasColumnType("float");
            entity.Property(e => e.PresionSistolica).HasColumnType("float");
            entity.Property(e => e.PresionDiastolica).HasColumnType("float");
            entity.Property(e => e.AlturaCm).HasColumnType("int");
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
            entity.HasOne<Clinica>().WithMany().HasForeignKey(e => e.IdClinica)
                .OnDelete(DeleteBehavior.NoAction).HasConstraintName("FK_Consulta_Clinica");
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
            entity.Ignore(e => e.IdMedico);
            entity.Property(e => e.Descripcion)
                .HasColumnName("Descripcion")
                .HasColumnType("nvarchar(300)")
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
            entity.Ignore(e => e.IdPaciente);
            entity.Property(e => e.IdConsulta)
                .HasColumnName("IdConsulta")
                .HasColumnType("int")
                .IsRequired(false);
            entity.Ignore(e => e.IdMedico);
            entity.Property(e => e.NombreExamen)
                .HasColumnName("NombreExamen")
                .HasColumnType("nvarchar(200)")
                .HasMaxLength(200)
                .IsRequired(true);
            entity.Property(e => e.FechaExamen)
                .HasColumnName("FechaExamen")
                .HasColumnType("datetime2")
                .IsRequired(true);
            entity.Ignore(e => e.Resultado);
            entity.Property(e => e.IdDiagnostico).HasColumnType("int");
            entity.Property(e => e.IdTurno).HasColumnType("int");
            entity.Property(e => e.FechaResultado).HasColumnType("date");
            entity.Property(e => e.Prioridad).HasColumnType("nvarchar(20)");
            entity.HasOne<Consulta>()
                .WithMany()
                .HasForeignKey(e => e.IdConsulta)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Examen_Consulta");
            entity.HasOne<Diagnostico>().WithMany().HasForeignKey(e => e.IdDiagnostico)
                .OnDelete(DeleteBehavior.NoAction).HasConstraintName("FK_Examen_Diagnostico");
            entity.HasOne<Turno>().WithMany().HasForeignKey(e => e.IdTurno)
                .OnDelete(DeleteBehavior.NoAction).HasConstraintName("FK_Examen_Turno");
        });

        modelBuilder.Entity<Evolucion>(entity =>
        {
            entity.ToTable("HistorialMedico");
            entity.HasKey(e => e.IdEvolucion);
            entity.Property(e => e.IdEvolucion)
                .HasColumnName("IdHistorial")
                .HasColumnType("int")
                .IsRequired(true)
                .UseIdentityColumn(1, 1);
            entity.Ignore(e => e.IdPaciente);
            entity.Property(e => e.IdConsulta)
                .HasColumnName("IdConsulta")
                .HasColumnType("int")
                .IsRequired(false);
            entity.Ignore(e => e.IdMedico);
            entity.Property(e => e.FechaEvolucion)
                .HasColumnName("FechaHistorial")
                .HasColumnType("datetime2")
                .IsRequired(true);
            entity.Property(e => e.Descripcion)
                .HasColumnName("Descripcion")
                .HasColumnType("nvarchar(300)")
                .IsRequired(true);
            entity.Property(e => e.IdDiagnostico).HasColumnType("int");
            entity.HasOne<Consulta>()
                .WithMany()
                .HasForeignKey(e => e.IdConsulta)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Evolucion_Consulta");
            entity.HasOne<Diagnostico>().WithMany().HasForeignKey(e => e.IdDiagnostico)
                .OnDelete(DeleteBehavior.NoAction).HasConstraintName("FK_HistorialMedico_Diagnostico");
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
            entity.Ignore(e => e.IdMedico);
            entity.Property(e => e.Descripcion)
                .HasColumnName("Descripcion")
                .HasColumnType("nvarchar(300)")
                .IsRequired(true);
            entity.Property(e => e.Indicaciones)
                .HasColumnName("Indicaciones")
                .HasColumnType("nvarchar(300)")
                .IsRequired(false);
            entity.Property(e => e.IdLote).HasColumnType("int");
            entity.Property(e => e.Cantidad).HasColumnType("smallint");
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
            entity.HasOne<LoteMedicamento>().WithMany().HasForeignKey(e => e.IdLote)
                .OnDelete(DeleteBehavior.NoAction).HasConstraintName("FK_Tratamiento_Lote");
        });

        modelBuilder.Entity<Clinica>(entity =>
        {
            entity.ToTable("Clinica");
            entity.HasKey(x => x.IdClinica);
            entity.Property(x => x.IdClinica).UseIdentityColumn();
            entity.Property(x => x.NombreClinica).HasColumnType("nvarchar(100)").IsRequired();
            entity.Property(x => x.Especialidad).HasColumnType("nvarchar(100)");
            entity.Property(x => x.Activa).HasDefaultValue(true);
            entity.HasOne<Sucursal>().WithMany().HasForeignKey(x => x.IdSucursal)
                .OnDelete(DeleteBehavior.NoAction).HasConstraintName("FK_Clinica_Sucursal");
        });

        modelBuilder.Entity<ContactoEmergencia>(entity =>
        {
            entity.ToTable("ContactoEmergencia");
            entity.HasKey(x => x.IdContacto);
            entity.Property(x => x.IdContacto).UseIdentityColumn();
            entity.Property(x => x.Nombres).HasColumnType("nvarchar(100)").IsRequired();
            entity.Property(x => x.Apellidos).HasColumnType("nvarchar(100)").IsRequired();
            entity.Property(x => x.Telefono).HasColumnType("nvarchar(20)").IsRequired();
            entity.Property(x => x.Direccion).HasColumnType("nvarchar(150)").IsRequired();
            entity.Property(x => x.CorreoElectronico).HasColumnType("nvarchar(75)");
            entity.Property(x => x.Parentesco).HasColumnType("nvarchar(50)");
            entity.HasOne<Paciente>().WithMany().HasForeignKey(x => x.IdPaciente)
                .OnDelete(DeleteBehavior.NoAction).HasConstraintName("FK_Contacto_Paciente");
        });

        modelBuilder.Entity<MovimientoInventario>(entity =>
        {
            entity.ToTable("MovimientoInventario", table =>
                table.HasCheckConstraint("CHK_Movimiento_Tipo", "([TipoMovimiento]='Vencimiento' OR [TipoMovimiento]='Ajuste' OR [TipoMovimiento]='Uso Interno' OR [TipoMovimiento]='Venta Publica' OR [TipoMovimiento]='Entrada')"));
            entity.HasKey(x => x.IdMovimiento);
            entity.Property(x => x.IdMovimiento).UseIdentityColumn();
            entity.Property(x => x.TipoMovimiento).HasColumnType("nvarchar(30)").IsRequired();
            entity.Property(x => x.FechaMovimiento).HasColumnType("datetime2").HasDefaultValueSql("sysutcdatetime()");
            entity.Property(x => x.Observaciones).HasColumnType("nvarchar(300)");
            entity.HasOne<LoteMedicamento>().WithMany().HasForeignKey(x => x.IdLote)
                .OnDelete(DeleteBehavior.NoAction).HasConstraintName("FK_Movimiento_Lote");
            entity.HasOne<Usuario>().WithMany().HasForeignKey(x => x.IdUsuario)
                .OnDelete(DeleteBehavior.NoAction).HasConstraintName("FK_Movimiento_Usuario");
            entity.HasOne<Sucursal>().WithMany().HasForeignKey(x => x.IdSucursal)
                .OnDelete(DeleteBehavior.NoAction).HasConstraintName("FK_Movimiento_Sucursal");
        });

        modelBuilder.Entity<Servicio>(entity =>
        {
            entity.ToTable("Servicio", table =>
            {
                table.HasCheckConstraint("CHK_Servicio_Precio", "([PrecioBase]>=(0))");
                table.HasCheckConstraint("CHK_Servicio_Tipo", "([TipoServicio]='Otro' OR [TipoServicio]='Procedimiento' OR [TipoServicio]='Habitacion' OR [TipoServicio]='Examen' OR [TipoServicio]='Consulta')");
            });
            entity.HasKey(x => x.IdServicio);
            entity.Property(x => x.IdServicio).UseIdentityColumn();
            entity.Property(x => x.Codigo).HasColumnType("nvarchar(50)").IsRequired();
            entity.Property(x => x.Nombre).HasColumnType("nvarchar(150)").IsRequired();
            entity.Property(x => x.Descripcion).HasColumnType("nvarchar(300)");
            entity.Property(x => x.PrecioBase).HasColumnType("decimal(18,2)");
            entity.Property(x => x.TipoServicio).HasColumnType("nvarchar(50)").IsRequired();
            entity.Property(x => x.Activo).HasDefaultValue(true);
            entity.HasIndex(x => x.Codigo).IsUnique();
        });

        modelBuilder.Entity<Turno>(entity =>
        {
            entity.ToTable("Turno", table =>
                table.HasCheckConstraint("CHK_Turno_Jornada", "([Jornada]='Nocturna' OR [Jornada]='Diurna')"));
            entity.HasKey(x => x.IdTurno);
            entity.Property(x => x.IdTurno).UseIdentityColumn();
            entity.Property(x => x.Nombre).HasColumnType("nvarchar(50)").IsRequired();
            entity.Property(x => x.Codigo).HasColumnType("nvarchar(20)").IsRequired();
            entity.Property(x => x.HoraEntrada).HasColumnType("time(7)");
            entity.Property(x => x.HoraSalida).HasColumnType("time(7)");
            entity.Property(x => x.Jornada).HasColumnType("nvarchar(20)").IsRequired();
            entity.Property(x => x.Activo).HasDefaultValue(true);
            entity.HasIndex(x => x.Codigo).IsUnique();
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
