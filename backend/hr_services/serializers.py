from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Empleado, SolicitudVacaciones, ConstanciaLaboral, TicketRH, BaseConocimientoRH, NotaTareaColaborador

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
            'antiguedad_anios', 'foto_perfil', 'foto_perfil_url',
            'horario_entrada', 'horario_salida', 'dias_laborales', 'modalidad_trabajo'
        ]
        read_only_fields = ['id', 'user', 'numero_empleado', 'dias_vacaciones_disponibles', 'antiguedad_anios', 'foto_perfil_url']

    def get_foto_perfil_url(self, obj):
        if obj.foto_perfil:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.foto_perfil.url)
            url = obj.foto_perfil.url
            if url.startswith('http'):
                return url
            return f"http://localhost:8000{url if url.startswith('/') else '/' + url}"
        return None


class SolicitudVacacionesSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.SerializerMethodField()
    empleado_numero = serializers.ReadOnlyField(source='empleado.numero_empleado')
    empleado_puesto = serializers.ReadOnlyField(source='empleado.puesto')
    empleado_departamento = serializers.ReadOnlyField(source='empleado.departamento')
    empleado_avatar = serializers.SerializerMethodField()
    empleado_dias_disponibles = serializers.ReadOnlyField(source='empleado.dias_vacaciones_disponibles')
    empleado_dias_laborales = serializers.ReadOnlyField(source='empleado.dias_laborales')
    dias_solicitados = serializers.IntegerField(required=False)

    class Meta:
        model = SolicitudVacaciones
        fields = [
            'id', 'empleado', 'empleado_nombre', 'empleado_numero',
            'empleado_puesto', 'empleado_departamento', 'empleado_avatar',
            'empleado_dias_disponibles', 'empleado_dias_laborales', 'fecha_inicio', 'fecha_fin',
            'dias_solicitados', 'motivo', 'estado', 'fecha_creacion'
        ]
        read_only_fields = ['empleado', 'estado', 'fecha_creacion']

    def get_empleado_nombre(self, obj):
        return obj.empleado.user.get_full_name() or obj.empleado.user.username

    def get_empleado_avatar(self, obj):
        if getattr(obj, 'empleado', None) and obj.empleado.foto_perfil:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.empleado.foto_perfil.url)
            url = obj.empleado.foto_perfil.url
            if url.startswith('http'):
                return url
            return f"http://localhost:8000{url if url.startswith('/') else '/' + url}"
        return None


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
    empleado_nombre = serializers.SerializerMethodField()
    empleado_numero = serializers.ReadOnlyField(source='empleado.numero_empleado')
    empleado_puesto = serializers.ReadOnlyField(source='empleado.puesto')
    empleado_departamento = serializers.ReadOnlyField(source='empleado.departamento')
    empleado_avatar = serializers.SerializerMethodField()

    class Meta:
        model = TicketRH
        fields = [
            'id', 'folio', 'empleado', 'empleado_nombre', 'empleado_numero',
            'empleado_puesto', 'empleado_departamento', 'empleado_avatar',
            'asunto', 'descripcion', 'prioridad', 'estado', 'respuesta_rh',
            'fecha_creacion', 'fecha_actualizacion'
        ]
        read_only_fields = ['folio', 'empleado', 'estado', 'respuesta_rh', 'fecha_creacion', 'fecha_actualizacion']

    def get_empleado_nombre(self, obj):
        return obj.empleado.user.get_full_name() or obj.empleado.user.username

    def get_empleado_avatar(self, obj):
        if getattr(obj, 'empleado', None) and obj.empleado.foto_perfil:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.empleado.foto_perfil.url)
            url = obj.empleado.foto_perfil.url
            if url.startswith('http'):
                return url
            return f"http://localhost:8000{url if url.startswith('/') else '/' + url}"
        return None


class BaseConocimientoRHSerializer(serializers.ModelSerializer):
    class Meta:
        model = BaseConocimientoRH
        fields = ['id', 'categoria', 'pregunta', 'respuesta', 'activa', 'fecha_actualizacion']


class NotaTareaColaboradorSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.SerializerMethodField()

    class Meta:
        model = NotaTareaColaborador
        fields = [
            'id', 'empleado', 'empleado_nombre', 'titulo', 'descripcion', 'fecha',
            'hora', 'tipo', 'completada', 'color', 'fecha_creacion',
            'fecha_actualizacion'
        ]
        read_only_fields = ['id', 'empleado', 'fecha_creacion', 'fecha_actualizacion']

    def get_empleado_nombre(self, obj):
        return obj.empleado.user.get_full_name() or obj.empleado.user.username

