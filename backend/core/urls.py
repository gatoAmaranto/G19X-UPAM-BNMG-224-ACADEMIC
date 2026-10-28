import os
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/hr/', include('hr_services.urls')),
    path('api/agent/', include('ai_agents.urls')),
    # Seguridad: Unicamente la carpeta avatares/ es publica para visualizacion de fotos institucionales.
    # Las constancias laborales contienen datos sensibles (sueldos, etc.) y solo se sirven con sesion via /api/hr/constancia/.
    re_path(r'^media/avatares/(?P<path>.*)$', serve, {'document_root': os.path.join(settings.MEDIA_ROOT, 'avatares')}),
]
