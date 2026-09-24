import uuid
from django.db import models
from django.contrib.auth.models import User

class Empleado(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil_empleado')
    numero_empleado = models.CharField(max_length=20, unique=True, verbose_name="Número de Empleado")
    puesto = models.CharField(max_length=100, verbose_name="Puesto")
    departamento = models.CharField(max_length=100, default="Tecnología de la Información")
    fecha_ingreso = models.DateField(verbose_name="Fecha de Ingreso")
    salario_mensual = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    dias_vacaciones_totales = models.PositiveIntegerField(default=12)
    dias_vacaciones_tomados = models.PositiveIntegerField(default=0)

    @property
    def dias_vacaciones_disponibles(self):
        return max(0, self.dias_vacaciones_totales - self.dias_vacaciones_tomados)

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} ({self.numero_empleado})"


class SolicitudVacaciones(models.Model):
    ESTADOS = [
        ('PENDIENTE', 'Pendiente de Aprobación'),
        ('APROBADO', 'Aprobado'),
        ('RECHAZADO', 'Rechazado'),
    ]

    empleado = models.ForeignKey(Empleado, on_delete=models.CASCADE, related_name='solicitudes_vacaciones')
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    dias_solicitados = models.PositiveIntegerField()
    motivo = models.TextField(blank=True, default='')
    estado = models.CharField(max_length=20, choices=ESTADOS, default='PENDIENTE')
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Vacaciones {self.empleado.numero_empleado}: {self.fecha_inicio} al {self.fecha_fin} ({self.estado})"


class ConstanciaLaboral(models.Model):
    empleado = models.ForeignKey(Empleado, on_delete=models.CASCADE, related_name='constancias')
    dirigido_a = models.CharField(max_length=200, default="A quien corresponda")
    incluir_sueldo = models.BooleanField(default=False)
    archivo_pdf = models.FileField(upload_to='constancias/', null=True, blank=True)
    fecha_emision = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Constancia {self.empleado.numero_empleado} - {self.fecha_emision.strftime('%Y-%m-%d')}"


class TicketRH(models.Model):
    PRIORIDADES = [
        ('BAJA', 'Baja'),
        ('MEDIA', 'Media'),
        ('ALTA', 'Alta'),
    ]
    ESTADOS = [
        ('ABIERTO', 'Abierto'),
        ('EN_PROCESO', 'En Proceso'),
        ('RESUELTO', 'Resuelto'),
        ('CERRADO', 'Cerrado'),
    ]

    folio = models.CharField(max_length=30, unique=True, editable=False)
    empleado = models.ForeignKey(Empleado, on_delete=models.CASCADE, related_name='tickets')
    asunto = models.CharField(max_length=200)
    descripcion = models.TextField()
    prioridad = models.CharField(max_length=10, choices=PRIORIDADES, default='MEDIA')
    estado = models.CharField(max_length=20, choices=ESTADOS, default='ABIERTO')
    respuesta_rh = models.TextField(blank=True, default='')
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.folio:
            self.folio = f"TK-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Ticket {self.folio}: {self.asunto} ({self.estado})"


class BaseConocimientoRH(models.Model):
    categoria = models.CharField(max_length=100, default="Políticas Generales")
    pregunta = models.CharField(max_length=300)
    respuesta = models.TextField()
    activa = models.BooleanField(default=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"[{self.categoria}] {self.pregunta}"
