import os
from django.core.files.base import ContentFile
from rest_framework import status, views, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotAuthenticated
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.http import HttpResponse

from .models import Empleado, SolicitudVacaciones, ConstanciaLaboral, TicketRH, BaseConocimientoRH, NotaTareaColaborador
from .serializers import (
    EmpleadoSerializer, SolicitudVacacionesSerializer,
    ConstanciaLaboralSerializer, TicketRHSerializer, BaseConocimientoRHSerializer,
    NotaTareaColaboradorSerializer
)
from .utils_pdf import generar_pdf_constancia_laboral
from .utils_laborales import es_dia_laboral, calcular_dias_laborales
from authentication.permissions import IsRecursosHumanos



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

        import datetime
        hoy = datetime.date.today()

        # 1. Bloquear solicitudes en fechas anteriores a hoy
        if fecha_inicio < hoy:
            return Response({
                'error': 'No es posible solicitar vacaciones para fechas anteriores al día de hoy.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if fecha_fin < fecha_inicio:
            return Response({
                'error': 'La fecha de fin debe ser posterior o igual a la fecha de inicio.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 2. Consultar horario laboral del colaborador y validar que inicio y fin sean dias habiles
        jornada = empleado.dias_laborales or 'Lunes a Viernes'
        if not es_dia_laboral(fecha_inicio, jornada):
            return Response({
                'error': f'La fecha de inicio ({fecha_inicio.strftime("%Y-%m-%d")}) no es un día laboral según tu jornada ({jornada}). Las vacaciones solo pueden iniciar en días laborales.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not es_dia_laboral(fecha_fin, jornada):
            return Response({
                'error': f'La fecha de fin ({fecha_fin.strftime("%Y-%m-%d")}) no es un día laboral según tu jornada ({jornada}). Las vacaciones solo pueden finalizar en días laborales.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Calcular dias laborales reales en el rango
        dias_habiles = calcular_dias_laborales(fecha_inicio, fecha_fin, jornada)
        dias_calculados = len(dias_habiles)

        if dias_calculados <= 0:
            return Response({
                'error': f'El periodo seleccionado no comprende ningún día laboral según tu jornada ({jornada}).'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 4. Validar saldo disponible de vacaciones
        if dias_calculados > empleado.dias_vacaciones_disponibles:
            return Response({
                'error': f'No tienes suficientes días disponibles. Tienes {empleado.dias_vacaciones_disponibles} días y el periodo laboral seleccionado requiere {dias_calculados} días.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 5. Persistir solicitud forzando dias_solicitados a los dias laborales reales calculados
        solicitud = serializer.save(empleado=empleado, dias_solicitados=dias_calculados)
        return Response(SolicitudVacacionesSerializer(solicitud, context={'request': request}).data, status=status.HTTP_201_CREATED)


from django.views.decorators.clickjacking import xframe_options_exempt
from django.utils.decorators import method_decorator


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


# --- ADMIN BACKOFFICE VIEWS ---

class AdminVacacionesView(views.APIView):
    permission_classes = [IsRecursosHumanos]

    def get(self, request):
        solicitudes = SolicitudVacaciones.objects.all().order_by('-fecha_creacion')
        serializer = SolicitudVacacionesSerializer(solicitudes, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        empleado_id = request.data.get('empleado_id')
        if empleado_id:
            empleado = get_object_or_404(Empleado, pk=empleado_id)
        else:
            empleado = get_demo_or_current_empleado(request)

        serializer = SolicitudVacacionesSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            fecha_inicio = serializer.validated_data.get('fecha_inicio')
            fecha_fin = serializer.validated_data.get('fecha_fin')
            jornada = empleado.dias_laborales or 'Lunes a Viernes'
            dias_habiles = calcular_dias_laborales(fecha_inicio, fecha_fin, jornada)
            dias_calculados = len(dias_habiles) if dias_habiles else serializer.validated_data.get('dias_solicitados', 1)
            estado = request.data.get('estado', 'APROBADO')
            solicitud = serializer.save(empleado=empleado, estado=estado, dias_solicitados=dias_calculados)
            if estado == 'APROBADO':
                empleado.dias_vacaciones_tomados += dias_calculados
                empleado.save()
            return Response(SolicitudVacacionesSerializer(solicitud, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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
            return Response(SolicitudVacacionesSerializer(solicitud, context={'request': request}).data, status=status.HTTP_200_OK)

        return Response({'error': 'Estado no válido.'}, status=status.HTTP_400_BAD_REQUEST)


class AdminTicketsView(views.APIView):
    permission_classes = [IsRecursosHumanos]

    def get(self, request):
        tickets = TicketRH.objects.all().order_by('-fecha_creacion')
        serializer = TicketRHSerializer(tickets, many=True, context={'request': request})
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
        return Response(TicketRHSerializer(ticket, context={'request': request}).data, status=status.HTTP_200_OK)


import io
import pypdf

class AdminFAQView(views.APIView):
    permission_classes = [IsRecursosHumanos]

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
    permission_classes = [IsRecursosHumanos]

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

