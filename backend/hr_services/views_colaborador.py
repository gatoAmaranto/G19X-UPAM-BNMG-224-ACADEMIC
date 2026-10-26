import os
from django.core.files.base import ContentFile
from rest_framework import status, views, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotAuthenticated
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from django.views.decorators.clickjacking import xframe_options_exempt
from django.utils.decorators import method_decorator
from django.core.exceptions import ValidationError

from .models import Empleado, SolicitudVacaciones, ConstanciaLaboral, TicketRH, BaseConocimientoRH, NotaTareaColaborador
from .serializers import (
    EmpleadoSerializer, SolicitudVacacionesSerializer,
    ConstanciaLaboralSerializer, TicketRHSerializer, BaseConocimientoRHSerializer,
    NotaTareaColaboradorSerializer
)
from .utils_pdf import generar_pdf_constancia_laboral
from .services import crear_solicitud_vacaciones


def get_demo_or_current_empleado(request):
    """
    Obtiene el perfil Empleado asociado al usuario autenticado.
    No devuelve al empleado demo si el usuario no ha iniciado sesion.
    """
    if not request.user or not request.user.is_authenticated:
        raise NotAuthenticated("Debe iniciar sesión para acceder a las funciones del colaborador.")

    is_rh = getattr(request.user, 'is_rh_admin', False) or request.user.is_staff
    empleado, _ = Empleado.objects.get_or_create(
        user=request.user,
        defaults={
            'numero_empleado': f"RH-{request.user.id:04d}" if is_rh else f"EMP-{request.user.id:04d}",
            'puesto': 'Especialista de Recursos Humanos' if is_rh else 'Consultor TI',
            'departamento': 'Recursos Humanos' if is_rh else 'Desarrollo de Software',
            'fecha_ingreso': '2024-01-15',
            'salario_mensual': 45000.00 if is_rh else 35000.00,
            'dias_vacaciones_totales': 14 if is_rh else 12,
            'dias_vacaciones_tomados': 2 if is_rh else 3
        }
    )
    return empleado


class PerfilEmpleadoView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        empleado = get_demo_or_current_empleado(request)
        serializer = EmpleadoSerializer(empleado, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        empleado = get_demo_or_current_empleado(request)
        if 'foto_perfil' in request.FILES:
            if empleado.foto_perfil:
                try:
                    empleado.foto_perfil.delete(save=False)
                except Exception:
                    pass
            empleado.foto_perfil = request.FILES['foto_perfil']
            empleado.save()

        serializer = EmpleadoSerializer(empleado, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(EmpleadoSerializer(empleado, context={'request': request}).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request):
        return self.patch(request)


class PerfilAvatarUploadView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        empleado = get_demo_or_current_empleado(request)
        if 'foto_perfil' not in request.FILES:
            return Response({'error': 'No se proporcionó ningún archivo de imagen.'}, status=status.HTTP_400_BAD_REQUEST)

        archivo = request.FILES['foto_perfil']
        if not archivo.content_type.startswith('image/'):
            return Response({'error': 'El archivo debe ser una imagen válida (JPG, PNG, GIF, WebP).'}, status=status.HTTP_400_BAD_REQUEST)

        if empleado.foto_perfil:
            try:
                empleado.foto_perfil.delete(save=False)
            except Exception:
                pass

        empleado.foto_perfil = archivo
        empleado.save()
        serializer = EmpleadoSerializer(empleado, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request):
        empleado = get_demo_or_current_empleado(request)
        if empleado.foto_perfil:
            try:
                empleado.foto_perfil.delete(save=False)
            except Exception:
                pass
            empleado.foto_perfil = None
            empleado.save()
        serializer = EmpleadoSerializer(empleado, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class VacacionesView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        empleado = get_demo_or_current_empleado(request)
        solicitudes = SolicitudVacaciones.objects.filter(empleado=empleado).order_by('-fecha_creacion')
        serializer = SolicitudVacacionesSerializer(solicitudes, many=True, context={'request': request})
        return Response({
            'saldo': {
                'totales': empleado.dias_vacaciones_totales,
                'tomados': empleado.dias_vacaciones_tomados,
                'retenidos': empleado.dias_vacaciones_retenidos,
                'disponibles': empleado.dias_vacaciones_disponibles
            },
            'solicitudes': serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        empleado = get_demo_or_current_empleado(request)
        serializer = SolicitudVacacionesSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        fecha_inicio = serializer.validated_data.get('fecha_inicio')
        fecha_fin = serializer.validated_data.get('fecha_fin')
        motivo = serializer.validated_data.get('motivo', '')

        try:
            solicitud = crear_solicitud_vacaciones(
                empleado=empleado,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                motivo=motivo
            )
            return Response(
                SolicitudVacacionesSerializer(solicitud, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )
        except ValidationError as e:
            msg = e.message if hasattr(e, 'message') else str(e)
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)


@method_decorator(xframe_options_exempt, name='dispatch')
class GenerarConstanciaView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        empleado = get_demo_or_current_empleado(request)
        constancia = ConstanciaLaboral.objects.filter(empleado=empleado).last()
        if not constancia:
            constancia = ConstanciaLaboral.objects.create(
                empleado=empleado,
                dirigido_a="A quien corresponda",
                incluir_sueldo=True
            )
        pdf_buffer = generar_pdf_constancia_laboral(constancia)
        filename = f"Constancia_{empleado.numero_empleado}_{constancia.id}.pdf"
        
        disposition = 'attachment' if request.query_params.get('download') == 'true' else 'inline'
        response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'{disposition}; filename="{filename}"'
        return response

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
        try:
            constancia.archivo_pdf.save(filename, ContentFile(pdf_buffer.getvalue()), save=True)
        except Exception:
            pass

        # Si se solicita descarga directa
        if request.query_params.get('download') == 'true':
            response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        serializer = ConstanciaLaboralSerializer(constancia)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class TicketsViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TicketRHSerializer

    def get_queryset(self):
        empleado = get_demo_or_current_empleado(self.request)
        return TicketRH.objects.filter(empleado=empleado).order_by('-fecha_creacion')

    def perform_create(self, serializer):
        empleado = get_demo_or_current_empleado(self.request)
        serializer.save(empleado=empleado)


class BaseConocimientoViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = BaseConocimientoRHSerializer
    queryset = BaseConocimientoRH.objects.filter(activa=True)


class NotaTareaViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NotaTareaColaboradorSerializer

    def get_queryset(self):
        empleado = get_demo_or_current_empleado(self.request)
        queryset = NotaTareaColaborador.objects.filter(empleado=empleado)

        fecha = self.request.query_params.get('fecha')
        if fecha:
            queryset = queryset.filter(fecha=fecha)
        mes = self.request.query_params.get('mes')
        anio = self.request.query_params.get('anio')
        if mes and anio:
            try:
                queryset = queryset.filter(fecha__year=int(anio), fecha__month=int(mes))
            except ValueError:
                pass
        return queryset.order_by('fecha', 'hora', '-fecha_creacion')

    def perform_create(self, serializer):
        empleado = get_demo_or_current_empleado(self.request)
        serializer.save(empleado=empleado)
