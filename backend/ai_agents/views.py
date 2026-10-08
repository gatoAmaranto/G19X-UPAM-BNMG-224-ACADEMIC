from rest_framework import status, views
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from hr_services.views import get_demo_or_current_empleado
from .agent_graph import procesar_mensaje_agente
from .models import MensajeChat
from .serializers import MensajeChatSerializer

class ConversacionAgenteView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        mensaje = request.data.get('mensaje', '').strip()
        if not mensaje:
            return Response({'error': 'El mensaje no puede estar vacío.'}, status=status.HTTP_400_BAD_REQUEST)

        empleado = get_demo_or_current_empleado(request)

        # 1. Persistir mensaje del colaborador
        msg_usuario = MensajeChat.objects.create(
            empleado=empleado,
            remitente='user',
            texto=mensaje,
            tipo_accion='USER_INPUT'
        )

        # 2. Procesar respuesta mediante Agente Conversacional (Gemini / Reglas)
        resultado = procesar_mensaje_agente(mensaje, empleado)

        # 3. Persistir respuesta del agente
        msg_bot = MensajeChat.objects.create(
            empleado=empleado,
            remitente='bot',
            texto=resultado.get('respuesta', ''),
            tipo_accion=resultado.get('tipo_accion', 'INFO_GENERAL'),
            datos=resultado.get('datos', {})
        )

        resultado['id_usuario'] = msg_usuario.id
        resultado['id_bot'] = msg_bot.id
        resultado['timestamp'] = msg_bot.fecha_creacion.strftime('%H:%M')

        return Response(resultado, status=status.HTTP_200_OK)


class HistorialChatView(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        """
        Retorna el historial persistente de mensajes del colaborador actual.
        """
        empleado = get_demo_or_current_empleado(request)
        # Traer los últimos 60 mensajes en orden cronológico
        mensajes = MensajeChat.objects.filter(empleado=empleado).order_by('fecha_creacion')[:60]
        serializer = MensajeChatSerializer(mensajes, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request):
        """
        Permite al colaborador reiniciar y limpiar su historial de chat.
        """
        empleado = get_demo_or_current_empleado(request)
        eliminados, _ = MensajeChat.objects.filter(empleado=empleado).delete()
        return Response({
            'mensaje': 'Historial de conversación reiniciado con éxito.',
            'mensajes_eliminados': eliminados
        }, status=status.HTTP_200_OK)
