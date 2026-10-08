from django.db import models
from hr_services.models import Empleado

class MensajeChat(models.Model):
    REMITENTES = [
        ('user', 'Colaborador'),
        ('bot', 'Agente Virtual'),
    ]

    empleado = models.ForeignKey(Empleado, on_delete=models.CASCADE, related_name='mensajes_chat')
    remitente = models.CharField(max_length=10, choices=REMITENTES)
    texto = models.TextField()
    tipo_accion = models.CharField(max_length=50, blank=True, default='INFO_GENERAL')
    datos = models.JSONField(blank=True, default=dict)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['fecha_creacion']
        verbose_name = 'Mensaje de Chat'
        verbose_name_plural = 'Mensajes de Chat'

    def __str__(self):
        return f"[{self.fecha_creacion.strftime('%Y-%m-%d %H:%M')}] {self.remitente} ({self.empleado}): {self.texto[:40]}"
