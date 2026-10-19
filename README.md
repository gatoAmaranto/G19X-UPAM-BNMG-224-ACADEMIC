# Sistema de Autoservicio para Colaboradores mediante Agentes Conversacionales
## PluriOne — Develop Talent & Technology

Plataforma corporativa integral diseñada para transformar la experiencia del colaborador y optimizar la administración del capital humano. Integra un **Asistente Virtual Conversacional con Inteligencia Artificial**, arquitectura de microservicios contenerizada con Docker, autenticacion segura mediante Auth0 con control de acceso basado en roles (RBAC) y flujos automatizados de autoservicio de Recursos Humanos.

---

## Modulos del Sistema

### 1. Asistente Conversacional Inteligente con IA
- Impulsado por el modelo **Gemini 3.8 Flash** de Google con respaldo automatico entre modelos.
- **Llamada a herramientas operativas (Function Calling):** Permite tramitar solicitudes de vacaciones, emitir constancias laborales en PDF, registrar tickets de soporte y consultar saldos y folios en tiempo real desde el chat.
- **Memoria de contexto:** Recuerda los ultimos 10 mensajes para responder de forma coherente y adaptarse dinamicamente a cambios de tema.
- **Guardrails de dominio:** Enfoque estricto en consultas y politicas laborales de la empresa, rechazando amablemente solicitudes fuera del ambito de RH.

### 2. Gestion de Vacaciones
- Solicitudes digitales tanto desde el formulario web como a traves del agente conversacional.
- Validacion automatica de dias habiles conforme a la jornada de cada colaborador (ej. Lunes a Viernes).
- Bloqueo de solicitudes retroactivas y verificacion de saldo disponible.
- **Flujo de aprobacion por Recursos Humanos:** Regla unica de saldo donde los dias solicitados se descuentan exclusivamente al momento de ser aprobados por RH.

### 3. Mesa de Tickets de Soporte
- Apertura de folios institucionales (`TK-XXXXXXXX`) con categorizacion por prioridad (Baja, Media, Alta).
- Monitoreo en tiempo real del estado de atencion (Abierto, En Proceso, Resuelto, Cerrado).
- Resolucion y respuestas oficiales emitidas por Recursos Humanos visibles para el colaborador.

### 4. Emision de Constancias Laborales
- Generacion en tiempo real de cartas de trabajo oficiales en formato PDF membretado con folio unico y firma digital.
- Modalidad configurable con o sin desglose salarial.
- Descarga directa y previsualizador en modal.

### 5. Horario Institucional y Calendario Laboral
- Visualizacion de la jornada oficial de trabajo, esquemas de horario flexible (nucleo obligatorio de 10:00 a 16:00 hrs) y pausas activas.
- Calendario interactivo mensual para registrar notas, tareas personales y fechas aprobadas de vacaciones.

### 6. Expediente y Perfil del Colaborador
- Consulta de expediente institucional: puesto, departamento, fecha de ingreso, salario y calculo automatico de antiguedad.
- Carga, actualizacion y eliminacion de fotografia de perfil.

### 7. Base de Conocimiento RAG & FAQs (Backoffice RH)
- Ingesta masiva de documentos en formato `.pdf`, `.txt` o `.md` (reglamentos, contratos colectivos, politicas internas).
- Segmentacion y almacenamiento para alimentar el contexto del agente inteligente de IA.

---

## Roles de Acceso y Como Entrar

El sistema cuenta con dos perfiles de usuario diferenciados por permisos RBAC:

### Rol Colaborador
- **Funcionalidades:** Autoservicio completo, chat con el asistente de IA, consulta de saldo y solicitud de vacaciones, consulta de constancias, apertura y seguimiento de tickets, y calendario personal.
- **Acceso con Auth0:** Inicia sesion con una cuenta que tenga asignado el rol `colaborador` en Auth0.
- **Acceso en desarrollo local (Demo):** Si `DEBUG=True`, haz clic en el boton **"Probar como Colaborador"** en la cabecera superior. Ingresaras con el perfil de `demo_colaborador` (Juan Perez, EMP-0101).

### Rol Recursos Humanos (Administrador / Backoffice)
- **Funcionalidades:** Aprobacion o rechazo de solicitudes de vacaciones, mesa de ayuda para responder y resolver tickets, carga masiva de documentos RAG, alta de preguntas frecuentes y auditoria de expedientes.
- **Acceso con Auth0:** Inicia sesion con una cuenta que tenga el rol `recursos humanos` en Auth0 (o que cuente con `is_staff=True` en Django).
- **Acceso en desarrollo local (Demo):** Si `DEBUG=True`, haz clic en el boton **"Probar como Administrador RH"** en la cabecera superior. Ingresaras al panel de `demo_rh_admin` (Maria Rodriguez, RH-0001).

---

## Uso de Inteligencia Artificial

Para este proyecto se hace uso de Inteligencia Artificial mediante la herramienta **Antigravity** y el modelo **Gemini 3.8 Flash High**.

---

## Prerrequisitos

- **Git**
- **Docker Engine** (v24 o superior)
- **Docker Compose** (v2 o superior)
- Clave de API de **Google AI Studio** (`GEMINI_API_KEY`)
- Cuenta de **Auth0** (o usar las credenciales predeterminadas para desarrollo)

---

## Pasos de Instalacion

### 1. Clonar el repositorio
```bash
git clone https://github.com/gatoAmaranto/G19X-UPAM-BNMG-224-ACADEMIC.git
cd G19X-UPAM-BNMG-224-ACADEMIC/proyecto
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

Las variables para base de datos (PostgreSQL), cache (Redis) y autenticacion ya vienen configuradas para el entorno de desarrollo local.

### 3. Levantar los servicios con Docker
Ejecuta el siguiente comando en la raiz del proyecto:

```bash
docker compose up --build -d
```

Este comando descargara las imagenes, compilara los contenedores y levantara los cuatro servicios:
- **Frontend (React / Vite):** [http://localhost:5173](http://localhost:5173)
- **Backend (Django REST Framework):** [http://localhost:8000](http://localhost:8000)
- **Base de datos (PostgreSQL 16):** puerto `5432`
- **Cache y Broker (Redis 7):** puerto `6379`

### 4. Cargar datos iniciales y politicas RAG
Ejecuta el comando de poblado para inicializar colaboradores de ejemplo y el catalogo de politicas laborales:

```bash
docker compose exec backend python manage.py poblar_datos_iniciales
```

---

## Configuracion de Auth0 (Opcional para produccion)

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

### Poblar datos iniciales y politicas RAG
```bash
docker compose exec backend python manage.py poblar_datos_iniciales
```

### Crear un superusuario de Django
```bash
docker compose exec backend python manage.py createsuperuser
```

### Ejecutar pruebas automatizadas
```bash
docker compose exec backend python manage.py test
```
