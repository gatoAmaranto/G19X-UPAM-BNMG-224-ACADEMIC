from django.urls import path
from .views import ConversacionAgenteView

urlpatterns = [
    path('chat/', ConversacionAgenteView.as_view(), name='chat-agente'),
]
