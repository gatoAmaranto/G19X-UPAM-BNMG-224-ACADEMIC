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


from django.views.decorators.clickjacking import xframe_options_exempt
from django.utils.decorators import method_decorator


@method_decorator(xframe_options_exempt, name='dispatch')
class GenerarConstanciaView(views.APIView):
    permission_classes = [AllowAny]

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


import io
import pypdf

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


class AdminDocumentUploadView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        if 'archivo' not in request.FILES:
            return Response({'error': 'No se adjuntó ningún archivo en la petición.'}, status=status.HTTP_400_BAD_REQUEST)
        
        uploaded_file = request.FILES['archivo']
        filename = uploaded_file.name
        ext = filename.split('.')[-1].lower()

        extracted_text = ""
        if ext == 'pdf':
            try:
                reader = pypdf.PdfReader(uploaded_file)
                pages_text = []
                for page in reader.pages:
                    txt = page.extract_text()
                    if txt:
                        pages_text.append(txt)
                extracted_text = "\n\n".join(pages_text)
            except Exception as e:
                return Response({'error': f'Error al leer el archivo PDF: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        elif ext in ['txt', 'md']:
            try:
                extracted_text = uploaded_file.read().decode('utf-8', errors='ignore')
            except Exception as e:
                return Response({'error': f'Error al procesar el archivo de texto: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'error': 'Formato no permitido. Solo se aceptan archivos .pdf, .txt o .md'}, status=status.HTTP_400_BAD_REQUEST)

        if not extracted_text.strip():
            return Response({'error': 'El documento está vacío o no contiene texto extraíble.'}, status=status.HTTP_400_BAD_REQUEST)

        paragraphs = [p.strip() for p in extracted_text.split('\n\n') if len(p.strip()) > 30]
        doc_title = filename.rsplit('.', 1)[0].replace('_', ' ').replace('-', ' ').title()
        nuevas_faqs = []

        if len(paragraphs) <= 3:
            faq = BaseConocimientoRH.objects.create(
                categoria='Documentos Ingestados',
                pregunta=f'Políticas: {doc_title}',
                respuesta=extracted_text[:2000],
                activa=True
            )
            nuevas_faqs.append(faq)
        else:
            for idx, i in enumerate(range(0, len(paragraphs), 2)):
                chunk = "\n\n".join(paragraphs[i:i+2])
                faq = BaseConocimientoRH.objects.create(
                    categoria='Documentos Ingestados',
                    pregunta=f'{doc_title} — Sección #{idx + 1}',
                    respuesta=chunk[:1500],
                    activa=True
                )
                nuevas_faqs.append(faq)

        serializer = BaseConocimientoRHSerializer(nuevas_faqs, many=True)
        return Response({
            'mensaje': f'Se ingesto exitosamente el documento "{filename}" en la Base de Conocimiento RAG.',
            'registros_creados': len(nuevas_faqs),
            'datos': serializer.data
        }, status=status.HTTP_201_CREATED)

