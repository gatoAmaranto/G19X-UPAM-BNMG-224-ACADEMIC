from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PerfilEmpleadoView, VacacionesView, GenerarConstanciaView,
    TicketsViewSet, BaseConocimientoViewSet
)

router = DefaultRouter()
router.register(r'tickets', TicketsViewSet, basename='tickets')
router.register(r'faq', BaseConocimientoViewSet, basename='faq')

urlpatterns = [
    path('perfil/', PerfilEmpleadoView.as_view(), name='perfil-empleado'),
    path('vacaciones/', VacacionesView.as_view(), name='vacaciones'),
    path('constancia/', GenerarConstanciaView.as_view(), name='generar-constancia'),
    path('', include(router.urls)),
]
