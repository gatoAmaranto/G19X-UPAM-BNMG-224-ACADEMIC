from rest_framework import status, views
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from hr_services.views import get_demo_or_current_empleado
from .agent_graph import procesar_mensaje_agente

class ConversacionAgenteView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        mensaje = request.data.get('mensaje', '').strip()
        if not mensaje:
            return Response({'error': 'El mensaje no puede estar vacío.'}, status=status.HTTP_400_BAD_REQUEST)

        empleado = get_demo_or_current_empleado(request)
        resultado = procesar_mensaje_agente(mensaje, empleado)

        return Response(resultado, status=status.HTTP_200_OK)
