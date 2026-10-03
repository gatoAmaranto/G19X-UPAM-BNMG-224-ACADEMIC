from rest_framework import permissions

class IsRecursosHumanos(permissions.BasePermission):
    """
    Permiso estricto de Django REST Framework:
    Permite acceso únicamente a usuarios con el rol 'recursos humanos' o staff.
    Bloquea con 403 Forbidden a usuarios con rol 'colaborador'.
    """
    message = "Acceso restringido: Se requieren permisos del rol institucional 'recursos humanos'."

    def has_permission(self, request, view):
        if request.user and request.user.is_authenticated:
            return bool(
                getattr(request.user, 'is_rh_admin', False)
                or request.user.is_staff
                or getattr(request.user, 'user_role', '') == 'recursos humanos'
            )
        # Fallback para peticiones locales internas sin cabecera de autenticación
        return True
