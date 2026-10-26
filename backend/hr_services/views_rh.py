import io
import pypdf
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from rest_framework import status, views
from rest_framework.response import Response

from authentication.permissions import IsRecursosHumanos
from .models import Empleado, SolicitudVacaciones, TicketRH, BaseConocimientoRH
from .serializers import (
    SolicitudVacacionesSerializer, TicketRHSerializer, BaseConocimientoRHSerializer
)
from .services import crear_solicitud_vacaciones
from .views_colaborador import get_demo_or_current_empleado


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
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        fecha_inicio = serializer.validated_data.get('fecha_inicio')
        fecha_fin = serializer.validated_data.get('fecha_fin')
        motivo = serializer.validated_data.get('motivo', '')
        estado_deseado = request.data.get('estado', 'PENDIENTE')

        try:
            solicitud = crear_solicitud_vacaciones(
                empleado=empleado,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                motivo=motivo
            )
        except ValidationError as e:
            msg = e.message if hasattr(e, 'message') else str(e)
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)

        if estado_deseado == 'APROBADO':
            with transaction.atomic():
                empleado_lock = Empleado.objects.select_for_update().get(pk=empleado.pk)
                saldo_restante_legal = max(0, empleado_lock.dias_vacaciones_totales - empleado_lock.dias_vacaciones_tomados)
                if solicitud.dias_solicitados > saldo_restante_legal:
                    solicitud.delete()
                    return Response({
                        'error': f'No es posible aprobar la solicitud. El colaborador solo cuenta con {saldo_restante_legal} días y la solicitud requiere {solicitud.dias_solicitados} días.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                empleado_lock.dias_vacaciones_tomados += solicitud.dias_solicitados
                empleado_lock.save()
                solicitud.estado = 'APROBADO'
                solicitud.save()
        elif estado_deseado == 'RECHAZADO':
            solicitud.estado = 'RECHAZADO'
            solicitud.save()

        return Response(SolicitudVacacionesSerializer(solicitud, context={'request': request}).data, status=status.HTTP_201_CREATED)

    def patch(self, request, pk):
        solicitud = get_object_or_404(SolicitudVacaciones, pk=pk)
        nuevo_estado = request.data.get('estado')

        if nuevo_estado in ['APROBADO', 'RECHAZADO']:
            with transaction.atomic():
                empleado = Empleado.objects.select_for_update().get(pk=solicitud.empleado_id)
                if nuevo_estado == 'APROBADO' and solicitud.estado != 'APROBADO':
                    # Validar que el colaborador cuente con saldo total suficiente antes de aprobar
                    saldo_restante_legal = max(0, empleado.dias_vacaciones_totales - empleado.dias_vacaciones_tomados)
                    if solicitud.dias_solicitados > saldo_restante_legal:
                        return Response({
                            'error': f'No es posible aprobar la solicitud. El colaborador solo cuenta con {saldo_restante_legal} días y la solicitud requiere {solicitud.dias_solicitados} días.'
                        }, status=status.HTTP_400_BAD_REQUEST)
                    # Descontar días del saldo del empleado al aprobar
                    empleado.dias_vacaciones_tomados += solicitud.dias_solicitados
                    empleado.save()
                elif nuevo_estado == 'RECHAZADO' and solicitud.estado == 'APROBADO':
                    # Revertir descuento si la solicitud previamente aprobada se rechaza
                    empleado.dias_vacaciones_tomados = max(0, empleado.dias_vacaciones_tomados - solicitud.dias_solicitados)
                    empleado.save()

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


class AdminFAQView(views.APIView):
    permission_classes = [IsRecursosHumanos]

    def get(self, request):
        faqs = BaseConocimientoRH.objects.all().order_by('id')
        serializer = BaseConocimientoRHSerializer(faqs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = BaseConocimientoRHSerializer(data=request.data)
        if serializer.is_valid():
            faq = serializer.save()
            return Response(BaseConocimientoRHSerializer(faq).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        faq = get_object_or_404(BaseConocimientoRH, pk=pk)
        if 'activa' in request.data:
            faq.activa = bool(request.data['activa'])
        else:
            faq.activa = not faq.activa
        faq.save()
        return Response(BaseConocimientoRHSerializer(faq).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        faq = get_object_or_404(BaseConocimientoRH, pk=pk)
        faq.delete()
        return Response({'message': 'Reglamento eliminado correctamente de la base de conocimientos.'}, status=status.HTTP_200_OK)


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
