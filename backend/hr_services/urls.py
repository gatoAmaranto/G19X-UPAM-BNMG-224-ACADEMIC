from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PerfilEmpleadoView, PerfilAvatarUploadView, VacacionesView, GenerarConstanciaView,
    TicketsViewSet, BaseConocimientoViewSet,
    AdminVacacionesView, AdminTicketsView, AdminFAQView, AdminDocumentUploadView
)

router = DefaultRouter()
router.register(r'tickets', TicketsViewSet, basename='tickets')
router.register(r'faq', BaseConocimientoViewSet, basename='faq')

urlpatterns = [
    path('perfil/', PerfilEmpleadoView.as_view(), name='perfil-empleado'),
    path('perfil/avatar/', PerfilAvatarUploadView.as_view(), name='perfil-avatar'),
    path('vacaciones/', VacacionesView.as_view(), name='vacaciones'),
    path('constancia/', GenerarConstanciaView.as_view(), name='generar-constancia'),
    
    # Admin Backoffice Endpoints
    path('admin/perfil/', PerfilEmpleadoView.as_view(), name='admin-perfil'),
    path('admin/perfil/avatar/', PerfilAvatarUploadView.as_view(), name='admin-perfil-avatar'),
    path('admin/vacaciones/', AdminVacacionesView.as_view(), name='admin-vacaciones'),
    path('admin/vacaciones/<int:pk>/', AdminVacacionesView.as_view(), name='admin-vacaciones-detail'),
    path('admin/tickets/', AdminTicketsView.as_view(), name='admin-tickets'),
    path('admin/tickets/<int:pk>/', AdminTicketsView.as_view(), name='admin-tickets-detail'),
    path('admin/faq/', AdminFAQView.as_view(), name='admin-faq'),
    path('admin/faq/<int:pk>/', AdminFAQView.as_view(), name='admin-faq-detail'),
    path('admin/faq/upload/', AdminDocumentUploadView.as_view(), name='admin-faq-upload'),

    path('', include(router.urls)),
]
