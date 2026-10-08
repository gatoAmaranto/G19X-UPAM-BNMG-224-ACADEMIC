from django.urls import path
from .views import ConversacionAgenteView, HistorialChatView

urlpatterns = [
    path('chat/', ConversacionAgenteView.as_view(), name='chat-agente'),
    path('historial/', HistorialChatView.as_view(), name='historial-chat'),
]
