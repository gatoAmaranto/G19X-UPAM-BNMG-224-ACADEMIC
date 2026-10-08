from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Empleado, SolicitudVacaciones, ConstanciaLaboral, TicketRH, BaseConocimientoRH

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']


class EmpleadoSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    dias_vacaciones_disponibles = serializers.IntegerField(read_only=True)
    antiguedad_anios = serializers.IntegerField(read_only=True)
    foto_perfil_url = serializers.SerializerMethodField()

    class Meta:
        model = Empleado
        fields = [
            'id', 'user', 'numero_empleado', 'puesto', 'departamento',
            'fecha_ingreso', 'salario_mensual', 'dias_vacaciones_totales',
            'dias_vacaciones_tomados', 'dias_vacaciones_disponibles',
            'antiguedad_anios', 'foto_perfil', 'foto_perfil_url'
        ]
        read_only_fields = ['id', 'user', 'numero_empleado', 'dias_vacaciones_disponibles', 'antiguedad_anios', 'foto_perfil_url']

    def get_foto_perfil_url(self, obj):
        if obj.foto_perfil:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.foto_perfil.url)
            return obj.foto_perfil.url
        return None


class SolicitudVacacionesSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.ReadOnlyField(source='empleado.user.get_full_name')

    class Meta:
        model = SolicitudVacaciones
        fields = [
            'id', 'empleado', 'empleado_nombre', 'fecha_inicio',
            'fecha_fin', 'dias_solicitados', 'motivo', 'estado', 'fecha_creacion'
        ]
        read_only_fields = ['empleado', 'estado', 'fecha_creacion']


class ConstanciaLaboralSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.ReadOnlyField(source='empleado.user.get_full_name')

    class Meta:
        model = ConstanciaLaboral
        fields = [
            'id', 'empleado', 'empleado_nombre', 'dirigido_a',
            'incluir_sueldo', 'archivo_pdf', 'fecha_emision'
        ]
        read_only_fields = ['empleado', 'archivo_pdf', 'fecha_emision']


class TicketRHSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.ReadOnlyField(source='empleado.user.get_full_name')

    class Meta:
        model = TicketRH
        fields = [
            'id', 'folio', 'empleado', 'empleado_nombre', 'asunto',
            'descripcion', 'prioridad', 'estado', 'respuesta_rh',
            'fecha_creacion', 'fecha_actualizacion'
        ]
        read_only_fields = ['folio', 'empleado', 'estado', 'respuesta_rh', 'fecha_creacion', 'fecha_actualizacion']


class BaseConocimientoRHSerializer(serializers.ModelSerializer):
    class Meta:
        model = BaseConocimientoRH
        fields = ['id', 'categoria', 'pregunta', 'respuesta', 'activa', 'fecha_actualizacion']
