import os
from django.core.files.base import ContentFile
from rest_framework import status, views, viewsets
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.http import HttpResponse

from .models import Empleado, SolicitudVacaciones, ConstanciaLaboral, TicketRH, BaseConocimientoRH
from .serializers import (
    EmpleadoSerializer, SolicitudVacacionesSerializer,
    ConstanciaLaboralSerializer, TicketRHSerializer, BaseConocimientoRHSerializer
)
from .utils_pdf import generar_pdf_constancia_laboral


def get_demo_or_current_empleado(request):
    """
    Helper function to get the current authenticated employee,
    or a default demo employee for testing purposes.
    """
    if request.user and request.user.is_authenticated:
        empleado, _ = Empleado.objects.get_or_create(
            user=request.user,
            defaults={
                'numero_empleado': f"EMP-{request.user.id:04d}",
                'puesto': 'Consultor TI',
                'departamento': 'Desarrollo de Software',
                'fecha_ingreso': '2024-01-15',
                'salario_mensual': 35000.00,
                'dias_vacaciones_totales': 12,
                'dias_vacaciones_tomados': 3
            }
        )
        return empleado

    # Fallback to Demo Employee (Juan Perez)
    demo_user, _ = User.objects.get_or_create(
        username='demo_colaborador',
        defaults={
            'first_name': 'Juan',
            'last_name': 'Pérez',
            'email': 'juan.perez@develop.com.mx'
        }
    )
    demo_empleado, _ = Empleado.objects.get_or_create(
        user=demo_user,
        defaults={
            'numero_empleado': 'EMP-0101',
            'puesto': 'Desarrollador Full Stack',
            'departamento': 'Tecnología de la Información',
            'fecha_ingreso': '2023-03-01',
            'salario_mensual': 38500.00,
            'dias_vacaciones_totales': 14,
            'dias_vacaciones_tomados': 4
        }
    )
    return demo_empleado


class PerfilEmpleadoView(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        empleado = get_demo_or_current_empleado(request)
        serializer = EmpleadoSerializer(empleado)
        return Response(serializer.data, status=status.HTTP_200_OK)


class VacacionesView(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        empleado = get_demo_or_current_empleado(request)
        solicitudes = SolicitudVacaciones.objects.filter(empleado=empleado).order_by('-fecha_creacion')
        serializer = SolicitudVacacionesSerializer(solicitudes, many=True)
        return Response({
            'saldo': {
                'totales': empleado.dias_vacaciones_totales,
                'tomados': empleado.dias_vacaciones_tomados,
                'disponibles': empleado.dias_vacaciones_disponibles
            },
            'solicitudes': serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        empleado = get_demo_or_current_empleado(request)
        serializer = SolicitudVacacionesSerializer(data=request.data)
        if serializer.is_valid():
            dias_solicitados = serializer.validated_data.get('dias_solicitados', 1)
            if dias_solicitados > empleado.dias_vacaciones_disponibles:
                return Response({
                    'error': f'No tienes suficientes días disponibles. Tienes {empleado.dias_vacaciones_disponibles} días y solicitaste {dias_solicitados}.'
                }, status=status.HTTP_400_BAD_REQUEST)

            solicitud = serializer.save(empleado=empleado)
            return Response(SolicitudVacacionesSerializer(solicitud).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GenerarConstanciaView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        empleado = get_demo_or_current_empleado(request)
        dirigido_a = request.data.get('dirigido_a', 'A quien corresponda')
        incluir_sueldo = request.data.get('incluir_sueldo', False)

        constancia = ConstanciaLaboral.objects.create(
            empleado=empleado,
            dirigido_a=dirigido_a,
            incluir_sueldo=incluir_sueldo
        )

        # Generar archivo PDF con ReportLab
        pdf_buffer = generar_pdf_constancia_laboral(constancia)
        filename = f"Constancia_{empleado.numero_empleado}_{constancia.id}.pdf"
        constancia.archivo_pdf.save(filename, ContentFile(pdf_buffer.getvalue()))
        constancia.save()

        # Si se solicita descarga directa
        if request.query_params.get('download') == 'true':
            response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        serializer = ConstanciaLaboralSerializer(constancia)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class TicketsViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = TicketRHSerializer

    def get_queryset(self):
        empleado = get_demo_or_current_empleado(self.request)
        return TicketRH.objects.filter(empleado=empleado).order_by('-fecha_creacion')

    def perform_create(self, serializer):
        empleado = get_demo_or_current_empleado(self.request)
        serializer.save(empleado=empleado)


class BaseConocimientoViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = BaseConocimientoRHSerializer
    queryset = BaseConocimientoRH.objects.filter(activa=True)


# --- ADMIN BACKOFFICE VIEWS ---

class AdminVacacionesView(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        solicitudes = SolicitudVacaciones.objects.all().order_by('-fecha_creacion')
        serializer = SolicitudVacacionesSerializer(solicitudes, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        solicitud = get_object_or_404(SolicitudVacaciones, pk=pk)
        nuevo_estado = request.data.get('estado')

        if nuevo_estado in ['APROBADO', 'RECHAZADO']:
            if nuevo_estado == 'APROBADO' and solicitud.estado != 'APROBADO':
                # Descontar días del saldo del empleado
                solicitud.empleado.dias_vacaciones_tomados += solicitud.dias_solicitados
                solicitud.empleado.save()

            solicitud.estado = nuevo_estado
            solicitud.save()
            return Response(SolicitudVacacionesSerializer(solicitud).data, status=status.HTTP_200_OK)

        return Response({'error': 'Estado no válido.'}, status=status.HTTP_400_BAD_REQUEST)


class AdminTicketsView(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        tickets = TicketRH.objects.all().order_by('-fecha_creacion')
        serializer = TicketRHSerializer(tickets, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        ticket = get_object_or_404(TicketRH, pk=pk)
        respuesta = request.data.get('respuesta_rh', '')
        nuevo_estado = request.data.get('estado', 'RESUELTO')

        if respuesta:
            ticket.respuesta_rh = respuesta
        if nuevo_estado:
            ticket.estado = nuevo_estado

        ticket.save()
        return Response(TicketRHSerializer(ticket).data, status=status.HTTP_200_OK)


class AdminFAQView(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        faqs = BaseConocimientoRH.objects.all().order_by('-fecha_actualizacion')
        serializer = BaseConocimientoRHSerializer(faqs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = BaseConocimientoRHSerializer(data=request.data)
        if serializer.is_valid():
            faq = serializer.save()
            return Response(BaseConocimientoRHSerializer(faq).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        faq = get_object_or_404(BaseConocimientoRH, pk=pk)
        faq.activa = not faq.activa
        faq.save()
        return Response({'id': faq.id, 'activa': faq.activa}, status=status.HTTP_200_OK)
