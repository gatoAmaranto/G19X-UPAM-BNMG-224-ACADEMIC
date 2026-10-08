from rest_framework import serializers
from .models import MensajeChat

class MensajeChatSerializer(serializers.ModelSerializer):
    timestamp = serializers.SerializerMethodField()

    class Meta:
        model = MensajeChat
        fields = ['id', 'remitente', 'texto', 'tipo_accion', 'datos', 'fecha_creacion', 'timestamp']

    def get_timestamp(self, obj):
        return obj.fecha_creacion.strftime('%H:%M')
