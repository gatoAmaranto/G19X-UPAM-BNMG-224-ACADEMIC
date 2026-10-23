from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/hr/', include('hr_services.urls')),
    path('api/agent/', include('ai_agents.urls')),
    # Soporte para servir archivos multimedia (avatares y constancias PDF)
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
