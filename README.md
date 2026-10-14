# Instalacion y Ejecucion

Guia de configuracion y ejecucion del repositorio en entorno local.

---

## Prerrequisitos

- **Git**
- **Docker Engine** (v24 o superior)
- **Docker Compose** (v2 o superior)
- Clave de API de **Google AI Studio** (`GEMINI_API_KEY`)
- Cuenta de **Auth0** (o usar los valores predeterminados para pruebas locales)

---

## Pasos de Instalacion

### 1. Clonar el repositorio
```bash
git clone https://github.com/gatoAmaranto/academy-rh.git
cd academy-rh/proyecto
```

### 2. Configurar variables de entorno
Copia la plantilla de ejemplo para crear el archivo `.env`:

```bash
cp .env.example .env
```

Abre el archivo `.env` y define tu clave de Google AI Studio:

```env
GEMINI_API_KEY=tu_clave_de_gemini
```

Las variables para base de datos (PostgreSQL), cache (Redis) y autenticacion ya vienen con valores funcionales para desarrollo local.

### 3. Levantar los servicios con Docker
Ejecuta el siguiente comando en la raiz del proyecto:

```bash
docker compose up --build -d
```

Este comando descargara las dependencias y levantara los cuatro contenedores necesarios:
- **Frontend (React / Vite):** `http://localhost:5173`
- **Backend (Django):** `http://localhost:8000`
- **Base de datos (PostgreSQL):** puerto `5432`
- **Cache (Redis):** puerto `6379`

---

## Configuracion de Auth0

El sistema utiliza Auth0 para el inicio de sesion unico (SSO) y control de acceso basado en roles (RBAC). Si deseas utilizar tu propio tenant de Auth0, sigue estos pasos:

### 1. Crear Aplicacion en Auth0
1. Ve a **Applications > Applications** en el dashboard de Auth0 y haz clic en **Create Application**.
2. Selecciona **Single Page Web Applications** (SPA) y asigna un nombre.
3. En la pestaña **Settings** de la aplicacion, configura las siguientes URLs:
   - **Allowed Callback URLs:** `http://localhost:5173`
   - **Allowed Logout URLs:** `http://localhost:5173`
   - **Allowed Web Origins:** `http://localhost:5173`
4. Guarda los cambios (**Save Changes**).
5. Copia el **Domain** y el **Client ID**.

### 2. Crear API en Auth0
1. Ve a **Applications > APIs** y haz clic en **Create API**.
2. Asigna un nombre y un **Identifier** (Audience), por ejemplo: `https://tu_dominio.auth0.com/api/v2/`.
3. Selecciona el algoritmo de firma **RS256**.
4. Guarda los cambios.

### 3. Configurar Roles y Action para inyectar claims en JWT
1. En **User Management > Roles**, crea dos roles:
   - `colaborador`
   - `recursos humanos`
2. Asigna los roles a los usuarios correspondientes en **User Management > Users**.
3. Para que el backend reciba los roles en el token de acceso, ve a **Actions > Library > Build Custom** (Trigger: *Login / Post Login*).
4. Agrega el siguiente codigo en la Action:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = `https://${event.tenant.domain}`;
  if (event.authorization && event.authorization.roles) {
    api.idToken.setCustomClaim(`${namespace}/roles`, event.authorization.roles);
    api.accessToken.setCustomClaim(`${namespace}/roles`, event.authorization.roles);
  }
};
```

5. Haz clic en **Deploy** y luego agregala al flujo en **Actions > Triggers > post-login**.

### 4. Actualizar variables en el archivo `.env`
Define los valores correspondientes en tu `.env`:

```env
# Configuracion Backend (validacion JWT Bearer con JWKS)
AUTH0_DOMAIN=tu_dominio.us.auth0.com
AUTH0_AUDIENCE=https://tu_dominio.us.auth0.com/api/v2/

# Configuracion Frontend (SDK @auth0/auth0-react)
VITE_AUTH0_DOMAIN=tu_dominio.us.auth0.com
VITE_AUTH0_CLIENT_ID=tu_client_id_aqui
VITE_AUTH0_AUDIENCE=https://tu_dominio.us.auth0.com/api/v2/
```

*Nota:* Si no configuras tu propio tenant, la aplicacion utiliza credenciales predeterminadas para desarrollo local y permite alternar entre perfiles (`colaborador` y `recursos humanos`) directamente desde la cabecera.

---

## Accesos a la Aplicacion

- **Interfaz Web (Frontend):** [http://localhost:5173](http://localhost:5173)
- **API REST (Backend):** [http://localhost:8000/api/](http://localhost:8000/api/)
- **Panel Administrativo Django:** [http://localhost:8000/admin/](http://localhost:8000/admin/)

---

## Comandos Utiles

### Ver logs en tiempo real
```bash
docker compose logs -f
```

### Detener los contenedores
```bash
docker compose down
```

### Detener y eliminar volumenes de base de datos
```bash
docker compose down -v
```

### Ejecutar migraciones de base de datos
```bash
docker compose exec backend python manage.py migrate
```

### Crear un superusuario de Django
```bash
docker compose exec backend python manage.py createsuperuser
```

### Ejecutar pruebas automatizadas
```bash
docker compose exec backend python manage.py test
```
