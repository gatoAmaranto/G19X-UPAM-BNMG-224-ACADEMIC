"""
Módulo fachada para las vistas de servicios de Recursos Humanos.
Las vistas han sido modularizadas en:
  - views_colaborador.py: Vistas de autoservicio del colaborador (perfil, vacaciones, constancias, tickets, calendario).
  - views_rh.py: Vistas administrativas de Recursos Humanos (aprobaciones, resolución de tickets, FAQs y RAG).

Se re-exportan todos los símbolos aquí para garantizar compatibilidad con importaciones previas.
"""

from .views_colaborador import (
    get_demo_or_current_empleado,
    PerfilEmpleadoView,
    PerfilAvatarUploadView,
    VacacionesView,
    GenerarConstanciaView,
    TicketsViewSet,
    BaseConocimientoViewSet,
    NotaTareaViewSet,
)

from .views_rh import (
    AdminVacacionesView,
    AdminTicketsView,
    AdminFAQView,
    AdminDocumentUploadView,
)

__all__ = [
    'get_demo_or_current_empleado',
    'PerfilEmpleadoView',
    'PerfilAvatarUploadView',
    'VacacionesView',
    'GenerarConstanciaView',
    'TicketsViewSet',
    'BaseConocimientoViewSet',
    'NotaTareaViewSet',
    'AdminVacacionesView',
    'AdminTicketsView',
    'AdminFAQView',
    'AdminDocumentUploadView',
]
