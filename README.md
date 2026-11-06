# Sistema de Autoservicio para Colaboradores mediante Agentes Conversacionales
## PluriOne — Develop Talent & Technology

Plataforma corporativa integral diseñada para transformar la experiencia del colaborador y optimizar la administración del capital humano. Integra un **Asistente Virtual Conversacional con Inteligencia Artificial**, arquitectura de microservicios contenerizada con Docker, autenticacion segura mediante Auth0 con control de acceso basado en roles (RBAC) y flujos automatizados de autoservicio de Recursos Humanos.

---

## Modulos del Sistema

La aplicacion se estructura en dos portales especializados que comparten la misma experiencia responsiva y reglas de negocio:

### Portal del Colaborador (Autoservicio)

1. **Asistente Conversacional Inteligente con IA (Chat):**
   - Impulsado por la familia de modelos **Gemini Flash** de Google mediante el SDK oficial `google-genai` con llamada a herramientas operativas (Function Calling) y respaldo automatico entre versiones.
   - **Llamada a herramientas operativas (Function Calling):** Permite tramitar solicitudes de vacaciones, emitir constancias laborales en PDF, registrar y consultar tickets de soporte, y verificar saldos vacacionales en tiempo real desde la conversacion.
   - **Memoria de contexto:** Retiene los ultimos 10 mensajes del hilo conversacional para mantener la coherencia y adaptarse a cambios de tema.
   - **Personalidad cercana y dinamica de oficina:** Configurado con un tono calido, empatico y de companero de trabajo de confianza ("amigo de oficina"), con autorizacion para amenizar la jornada laboral contando chistes sanos y adivinanzas a peticion del colaborador (tanto mediante Gemini como a traves de su banco de respuestas de respaldo local).
   - **Orientacion a tramites de RH y manejo amigable fuera de contexto:** Especializado en la resolucion de tramites laborales (vacaciones, constancias, saldos, tickets y politicas RAG). Si el usuario consulta temas totalmente ajenos o tecnicos externos (recetas, politica externa, matematicas avanzadas), declina de forma amigable e informal reorientando la conversacion hacia sus gestiones de Recursos Humanos o amenizando la charla.
   - **Ergonomia visual:** Vista contenida a `100vh` en escritorio y `calc(100dvh - 56px)` en dispositivos moviles, con desplazamiento vertical interno en el historial de mensajes y barra de entrada de texto permanentemente anclada al pie de pantalla.

2. **Horario Institucional y Calendario Laboral:**
   - **Resumen metrico de saldos:** Tarjetas autoajustables con desglose de dias de vacaciones por antiguedad laboral conforme a la Ley Federal del Trabajo, dias tomados, dias pendientes de aprobacion y saldo disponible.
   - **Calendario interactivo mensual:** Navegacion entre meses con pastillas codificadas por color que senalizan periodos vacacionales aprobados y tareas programadas.
   - **Gestor de tareas y recordatorios:** Registro y eliminacion de notas personales con asignacion de color identificativo y fecha programada, visibles en el calendario mediante popovers informativos.
   - **Jornada laboral oficial:** Consulta de horario estandar, politicas de horario flexible (nucleo obligatorio de 10:00 a 16:00 hrs) y esquema de pausas activas.

3. **Centro de Tickets de Soporte:**
   - **Interfaz Master-Detail:** Panel lateral con listado de folios institucionales (`TK-XXXXXXXX`) y visor de detalle en tiempo real.
   - **Buscador y filtros dinamicos:** Busqueda instantanea por folio, asunto o descripcion, con filtros cuantitativos por estado (Todos, Abierto, En Proceso, Resuelto, Cerrado).
   - **Apertura de tickets:** Formulario modal con clasificacion por categoria (Sistemas, RH, Instalaciones, Nomina) y nivel de prioridad (Baja, Media, Alta).
   - **Seguimiento de etapas:** Linea de tiempo con fases de atencion (Creado, En Revision, En Proceso, Resuelto) y publicacion de resoluciones oficiales dictadas por Recursos Humanos.

4. **Emision de Constancias Laborales:**
   - **Generacion en tiempo real:** Creacion instantanea de cartas laborales oficiales en formato PDF membretado con folio institucional unico y firma electronica digital.
   - **Configuracion personalizada:** Opcion para dirigir la constancia a un destinatario particular ("A quien corresponda" o instituciones bancarias/consulares) y seleccion optativa de inclusion de sueldo mensual.
   - **Previsualizador integrado:** Visor de PDF embebido mediante React Portal directamente sobre el cuerpo del documento (`document.body`), garantizando centrado exacto y libre de desbordamientos de desplazamiento.
   - **Descarga protegida:** Enlace de descarga directa canalizado exclusivamente a traves de endpoint seguro autenticado.

5. **Expediente y Perfil del Colaborador:**
   - **Ficha institucional:** Consulta de puesto, departamento, numero de empleado, fecha de ingreso, salario mensual registrado y horario asignado.
   - **Calculo de antiguedad:** Determinacion automatica de los anos de servicio del colaborador dentro de la empresa.
   - **Fotografia institucional:** Carga, previsualizacion, actualizacion y eliminacion de avatar de perfil con almacenamiento persistente en `/media/avatares/`.

---

### Portal de Recursos Humanos (Backoffice RH)

1. **Gestion y Aprobacion de Vacaciones:**
   - **Supervision centralizada:** Visualizacion consolidada de todas las solicitudes de vacaciones del personal, agrupadas de forma ordenada por colaborador.
   - **Buscador rapido:** Filtrado dinamico por nombre del colaborador, departamento o numero de empleado.
   - **Dictamen en tiempo real:** Acciones inmediatas de Aprobacion o Rechazo con regla unica de saldo: los dias solicitados se descuentan de forma definitiva del balance del empleado unicamente al ser aprobados por RH.
   - **Proteccion transaccional:** Bloqueo pesimista a nivel de base de datos (`select_for_update`) que previene condiciones de carrera por solicitudes concurrentes.

2. **Mesa de Tickets de RH:**
   - **Monitoreo global de incidencias:** Supervision de folios abiertos y en atencion emitidos por los colaboradores de todos los departamentos.
   - **Clasificacion operativa:** Priorizacion por urgencia y antiguedad de la solicitud.
   - **Resolucion institucional:** Redaccion y envio de respuestas oficiales que actualizan el estado del ticket y notifican al colaborador en su portal de autoservicio.

3. **Base de Conocimiento RAG & FAQs:**
   - **Ingesta documental masiva:** Carga directa de normativas en archivos `.pdf`, `.txt` o `.md` (reglamentos interiores, politicas de viaticos, contratos colectivos).
   - **Gestion de preguntas frecuentes:** Alta manual de directrices laborales organizadas por categoria (Vacaciones, Nomina, Beneficios, Seguridad, General).
   - **Control de vigencia:** Interruptores de activacion/desactivacion inmediata (`activa=True/False`) para incorporar o suspender normativas al instante.
   - **Sincronizacion con IA:** Inyeccion automatica en el prompt de sistema del agente virtual, garantizando respuestas fundamentadas en las politicas vigentes.
   - **Depuracion normativa:** Eliminacion segura de politicas o manuales obsoletos.

4. **Supervision de Calendario RH:**
   - **Monitoreo de ausencias:** Vision global de descansos y periodos vacacionales autorizados de todos los colaboradores para prever cobertura operativa.
   - **Calendario institucional:** Registro de fechas festivas no laborales y efemerides corporativas.
   - **Agenda de gestion:** Registro de notas y recordatorios internos del area de Capital Humano.

5. **Perfil del Administrador RH:**
   - **Credenciales y permisos:** Identificacion oficial del usuario de Recursos Humanos con confirmacion de permisos administrativos (`is_staff`).
   - **Matriz de autorizaciones:** Auditoria visual de capacidades asignadas (aprobacion de vacaciones, resolucion de tickets, edicion de normativas RAG).
   - **Expediente personal:** Acceso a su propia antiguedad, horario institucional y balance vacacional como colaborador.

---

## Diseno Responsivo y App Shell Multiplataforma

La aplicacion incorpora una arquitectura de interfaz adaptativa (*App Shell*) disenada para brindar una experiencia de uso optima tanto en pantallas de escritorio como en dispositivos moviles:

### Arquitectura App Shell de Escritorio (> 768px)

- **Menu lateral sticky (280px):** Barra lateral fija en el borde izquierdo (`position: sticky`, `top: 0`, `height: 100vh`, `align-self: flex-start`, `flex-shrink: 0`) que contiene el logotipo institucional, navegacion por modulos, tarjeta del usuario autenticado y boton de cierre de sesion.
- **Cabecera institucional sticky (68px):** Barra superior fija con identificador de la vista activa, badge de rol y selector de perfiles de prueba.
- **Modo Chat con contencion de ventana:** Al ingresar al asistente conversacional, el contenedor principal activa la clase `.dashboard-main-wrapper.chat-mode`, fijando la altura maxima a `100vh` con `overflow: hidden`. El scroll ocurre exclusivamente dentro de la caja de mensajes, asegurando que la barra de redaccion y el boton Enviar permanezcan permanentemente visibles al pie de pantalla sin provocar desplazamientos indeseados en la ventana del navegador.
- **Modulos de gestion con desplazamiento fluido:** En los modulos de Calendario, Tickets, Constancias, FAQs y Perfil, la vista permite desplazamiento vertical natural mientras el menu lateral y la cabecera permanecen anclados. La contencion horizontal se gestiona con `overflow-x: clip` en `html, body`, eliminando desbordes laterales sin degradar el funcionamiento de `position: sticky`.

### Arquitectura Adaptativa Movil (<= 768px)

- **Barra de navegacion inferior fija (56px):** Barra inferior permanente (`.mobile-bottom-nav`) anclada al pie de la pantalla tactil:
  - **Diseno exclusivamente con iconos:** Presenta unicamente iconos vectoriales centrados (sin texto) correspondientes a los 5 modulos del portal activo, evitando saturacion visual y permitiendo navegacion ergonomica con una sola mano.
  - **Indicador visual de seleccion:** Resalta el modulo activo mediante una pildora con fondo de acento y realce de color institucional.
- **Ocultamiento del sidebar de escritorio:** El menu lateral se oculta por completo (`display: none`), liberando el 100% del ancho del dispositivo para el contenido de trabajo.
- **Cabecera compacta (56px):** Reduccion de espaciados y adaptacion de los botones de cambio de rol en modo demo a iconos simplificados con descripcion en atributo `title`, evitando desbordes horizontales.
- **Modo Chat adaptado a dispositivos moviles:** La altura se ajusta a `calc(100dvh - 56px)`, descontando con precision la altura de la barra inferior para garantizar que el campo de texto y el boton de envio se encuentren siempre al alcance del usuario, incluso con barras dinamicas de navegadores moviles.
- **Rejillas autoajustables:** Las tarjetas de saldos vacacionales (`minmax(85px, 1fr)`), etapas de tickets y selectores de fecha se reconfiguran automaticamente para prevenir compresiones o cortes de texto.

---

## Roles de Acceso y Modos de Operacion (Demo vs Produccion)

El sistema cuenta con dos perfiles de usuario diferenciados por permisos de Control de Acceso Basado en Roles (RBAC):

### Rol Colaborador
- **Capacidades:** Autoservicio completo, chat con el asistente de IA, consulta de saldos y solicitud de vacaciones, emision y descarga de constancias laborales, apertura y seguimiento de tickets de soporte, y calendario de tareas personales.
- **Acceso con Auth0:** Inicio de sesion institucional con una cuenta que tenga asignado el rol `colaborador` en el tenant de Auth0.
- **Acceso en desarrollo local (Modo Demo):** Si `DEBUG=True`, haz clic en el boton con icono de usuario (**"Colaborador"**) en la cabecera. Ingresaras al instante con el perfil de `demo_colaborador` (Juan Perez, EMP-0101).

### Rol Recursos Humanos (Administrador / Backoffice)
- **Capacidades:** Aprobacion o rechazo de vacaciones de todo el personal, resolucion de tickets de soporte, carga y administracion de documentos RAG, configuracion de preguntas frecuentes y consulta de auditoria.
- **Acceso con Auth0:** Inicio de sesion con una cuenta que posea el rol `recursos humanos` en Auth0 (o credencial `is_staff=True` en Django).
- **Acceso en desarrollo local (Modo Demo):** Si `DEBUG=True`, haz clic en el boton con icono de escudo (**"Admin RH"**) en la cabecera. Ingresaras directamente al panel de `demo_rh_admin` (Maria Rodriguez, RH-0001).

### Paridad y Diferencias entre Modo Demo y Modo Produccion

| Caracteristica | Modo Demostración (`DEBUG=True`) | Modo Produccion (`DEBUG=False`) |
| :--- | :--- | :--- |
| **Autenticacion** | Tokens locales mock validados por backend | Tokens JWT RS256 validados con JWKS de Auth0 |
| **Alternancia de Roles** | Botones de un clic en cabecera superior | Inicio de sesion y logout oficial via Auth0 |
| **Seguridad de Tokens Mock** | Permitidos para desarrollo y pruebas | Rechazados de forma estricta con error 401 |
| **Proteccion de Constancias** | `/media/constancias/` restringido | `/media/constancias/` bloqueado con 403/404 |
| **Vistas y Modulos** | 5 modulos Colaborador / 5 modulos RH | 5 modulos Colaborador / 5 modulos RH |
| **App Shell y Responsive** | Barra lateral desktop / Barra inferior movil | Barra lateral desktop / Barra inferior movil |
| **Agente Conversacional IA** | Gemini 3.8 Flash con Function Calling | Gemini 3.8 Flash con Function Calling |

---

## Uso de Inteligencia Artificial
Para este proyecto se hace uso de Inteligencia Artificial mediante la herramienta **Antigravity** y la familia de modelos **Gemini Flash** de Google (con lista ordenada de respaldo: Gemini 3.6 Flash, 3.5 Flash, 3.1 Flash-Lite, Flash-Latest y 3.8 Flash).

---

## Funcionamiento de la Base de Conocimiento (RAG en el MVP)
Para la etapa actual del sistema (MVP), la arquitectura de **Recuperacion y Generacion Aumentada (RAG)** opera mediante **inyeccion dinamica en contexto** (*In-Context Prompt Injection*):

1. **Recuperacion en tiempo real:** En cada interaccion del colaborador con el agente ([`agent_graph.py`](file:///home/benjamin/Documentos/%20Sistema%20de%20Autoservicio%20para%20Colaboradores%20mediante%20Agentes%20Conversacionales/proyecto/backend/ai_agents/agent_graph.py)), el backend consulta la tabla `BaseConocimientoRH` filtrando unicamente los registros activos (`activa=True`).
2. **Inyeccion de contexto al LLM:** Las preguntas frecuentes, respuestas y directrices normativas vigentes son formateadas e incorporadas directamente dentro del prompt de sistema (*System Prompt*) de Gemini.
3. **Generacion fundamentada:** El modelo responde consultas laborales utilizando estrictamente dicho contexto institucional, previniendo alucinaciones y asegurando apego a las politicas oficiales de la organizacion.
4. **Sincronizacion inmediata:** Debido a que no depende de indices vectoriales desactualizados ni reentrenamientos, cualquier cambio realizado desde el panel de RH (alta de reglamentos, edicion, desactivacion o eliminacion) tiene efecto inmediato en el comportamiento del asistente. Para fases de escalamiento masivo con cientos de documentos, la arquitectura esta disenada para incorporar busqueda semantica vectorial con `pgvector` y embeddings.

---

## Prerrequisitos

- **Git**
- **Docker Engine** (v24 o superior)
- **Docker Compose** (v2 o superior)
- Clave de API de **Google AI Studio** (`GEMINI_API_KEY`)
- Cuenta de **Auth0** (o usar el modo demo local con perfiles predeterminados)

---

## Pasos de Instalacion

### 1. Clonar el repositorio
```bash
git clone https://github.com/gatoAmaranto/G19X-UPAM-BNMG-224-ACADEMIC.git
cd G19X-UPAM-BNMG-224-ACADEMIC
```

### 2. Configurar variables de entorno
El proyecto incluye dos plantillas de variables de entorno para desacoplar el entorno de desarrollo local del entorno de produccion:
- `.env.example`: Disenada para iniciar de inmediato en desarrollo local con `DEBUG=True`, base de datos y puertos de prueba, y variables de Auth0 comentadas para permitir el inicio de sesion con perfiles demo locales sin depender de un tenant externo.
- `.env.prod.example`: Plantilla con directivas de produccion (`DEBUG=False`, claves criptograficas robustas, dominios en produccion, `VITE_API_BASE_URL=/api` y origenes CORS restringidos).

Para desarrollo local, copia la plantilla de desarrollo:

```bash
cp .env.example .env
```

Abre el archivo `.env` y define tu clave de Google AI Studio:

```env
GEMINI_API_KEY=tu_clave_de_gemini
```

Las variables para base de datos (PostgreSQL) y el servicio de infraestructura Redis ya vienen configuradas para el entorno de desarrollo local. Las variables de Auth0 se encuentran comentadas por defecto en el archivo `.env` para que el sistema funcione automaticamente en Modo Demo Local (con perfiles y tokens simulados sin conectarse a servidores externos); unicamente debes descomentarlas y definir tus claves si deseas conectar tu propio tenant corporativo de Auth0.

### 3. Levantar los servicios con Docker
Ejecuta el siguiente comando en la raiz del proyecto:

```bash
docker compose up --build -d
```

Este comando descargara las imagenes, compilara los contenedores y levantara los cuatro servicios:
- **Frontend (React / Vite):** [http://localhost:5173](http://localhost:5173)
- **Backend (Django REST Framework):** [http://localhost:8000](http://localhost:8000)
- **Base de datos (PostgreSQL 16):** puerto `5432`
- **Servicio de infraestructura Redis (Redis 7):** puerto `6379` (infraestructura aprovisionada para sesiones y soporte futuro de cache o tareas asincronas; ver seccion 5).

### 4. Ejecutar migraciones de base de datos
Aplica las migraciones iniciales para crear las tablas en la base de datos PostgreSQL:

```bash
docker compose exec backend python manage.py migrate
```

### 5. Cargar datos iniciales y politicas RAG
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
3. En la pestana **Settings** de la aplicacion, configura las siguientes URLs:
   - **Allowed Callback URLs:** `http://localhost:5173, http://localhost, http://localhost:8080`
   - **Allowed Logout URLs:** `http://localhost:5173, http://localhost, http://localhost:8080`
   - **Allowed Web Origins:** `http://localhost:5173, http://localhost, http://localhost:8080`
   *(Nota: Se incluye `http://localhost` y `http://localhost:8080` para admitir el stack de produccion servido por Nginx).*
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

*Nota:* Si dejas las variables de Auth0 comentadas o vacias en `.env`, la aplicacion opera en **Modo Demo Local** de forma 100% autonoma (sin conectarse a Auth0 ni realizar redirecciones externas), permitiendo alternar entre perfiles de prueba simulados (`colaborador` y `recursos humanos`) directamente desde la cabecera.

---

## Accesos a la Aplicacion

- **Interfaz Web (Frontend):** [http://localhost:5173](http://localhost:5173)
- **API REST (Backend):** [http://localhost:8000/api/](http://localhost:8000/api/)
- **Panel Administrativo Django:** [http://localhost:8000/admin/](http://localhost:8000/admin/)

### Conexion desde otros dispositivos en la red local (LAN)

Para ingresar a la aplicacion desde otro dispositivo conectado a la misma red local (como un telefono movil u otra computadora):

1. **Obtener la IP local del equipo anfitrion:**
   En Linux, ejecuta `ip -4 addr show` o `hostname -I` (ejemplo de direccion asignada: `192.168.100.90`).
2. **Acceder desde el navegador del dispositivo:**
   Ingresa a `http://<IP_LOCAL>:5173` (por ejemplo, `http://192.168.100.90:5173`).
   *Nota importante:* No utilices la IP que Vite imprime bajo "Network" dentro del contenedor (`172.19.0.x`), ya que corresponde a la red interna virtual de Docker y no es accesible desde fuera del host.
3. **Configuracion de Firewall (si aplica):**
   Si el sistema anfitrion tiene activo un cortafuegos (ej. `ufw`), permite el trafico entrante al puerto del frontend:
   ```bash
   sudo ufw allow 5173/tcp
   ```
4. **Si utilizas Auth0 en lugar de los perfiles demo:**
   Recuerda agregar `http://<IP_LOCAL>:5173` en el Dashboard de Auth0 dentro de los campos **Allowed Callback URLs**, **Allowed Logout URLs** y **Allowed Web Origins**.

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

### Ejecutar suite completa de pruebas automatizadas
El backend cuenta con 50 pruebas unitarias y de integracion que verifican autenticacion, roles, llamadas a herramientas de IA, reglas de vacaciones, tickets, RAG, generacion de constancias y persistencia cronologica de mensajes:
```bash
docker compose exec backend python manage.py test
```

---

## Despliegue y Consideraciones para Produccion

El proyecto incluye soporte diferenciado para desarrollo local y entornos de produccion empresarial mediante `docker-compose.prod.yml`.

### 1. Variables de entorno seguras para produccion (`.env` / `.env.prod.example`)
Antes de desplegar en un servidor accesible por colaboradores o usuarios reales, copia la plantilla de produccion `.env.prod.example` a tu `.env` y configura los valores requeridos:

- `DEBUG=False`: Deshabilita el modo de depuracion y bloquea tokens de prueba locales.
- `SECRET_KEY`: Genera una clave criptografica aleatoria y segura de al menos 50 caracteres (no utilices el valor por defecto).
- `ALLOWED_HOSTS`: Define el nombre de dominio o IP publica de tu servidor (ej. `autoservicio.tuempresa.com,localhost,backend`).
- `CORS_ALLOWED_ORIGINS`: Especifica los origenes web autorizados para interactuar con la API (incluye `http://localhost` para peticiones locales y tu dominio HTTPS de produccion).
- `USE_POSTGRES=True`: Garantiza la persistencia en el motor PostgreSQL institucional.
- `VITE_API_BASE_URL=/api`: Ruta relativa para que el frontend compilado dirija todas las peticiones a traves del proxy inverso Nginx.
- `FRONTEND_PORT`: Puerto externo para el frontend (por defecto `80`, o `8080` si el puerto 80 del host esta en uso).

### 2. Unificacion de URL de la API en el Frontend (`apiClient`)
Para garantizar que el frontend opere de manera homogenea tanto en desarrollo como en produccion (a traves de Nginx), todos los componentes del sistema utilizan una unica instancia centralizada de Axios exportada desde [`frontend/src/api/apiClient.js`](file:///home/benjamin/Documentos/%20Sistema%20de%20Autoservicio%20para%20Colaboradores%20mediante%20Agentes%20Conversacionales/proyecto/frontend/src/api/apiClient.js):
- Se eliminaron las rutas absolutas fijas de todos los componentes del cliente.
- Los componentes consumen rutas relativas (`/hr/...`, `/agent/...`), las cuales se concatenan automaticamente con `VITE_API_BASE_URL` (`/api`).
- `apiClient` inyecta automaticamente el token Bearer RS256 de Auth0 y gestiona respuestas de autorizacion (403 Forbidden).

### 3. Persistencia de Datos y Archivos Multimedia
El sistema desacopla el almacenamiento de datos del ciclo de vida de los contenedores mediante volumenes administrados por Docker y montajes de enlace (*bind mounts*):
- `postgres_data` (volumen administrado por Docker): Persistencia de la base de datos relacional PostgreSQL (usuarios, expedientes, tickets, solicitudes de vacaciones y base de conocimiento RAG).
- `redis_data` (volumen administrado por Docker): Persistencia de datos del servicio de infraestructura Redis.
- `./backend/media:/app/media` (montaje de enlace en el anfitrion): Almacenamiento directo en el sistema de archivos local para los archivos multimedia generados o subidos por los colaboradores: fotografias de perfil (`/media/avatares/`) y constancias laborales PDF oficiales (`/media/constancias/`), sin depender de un volumen nombrado `media_data`.

### 4. Servidor WSGI y Proxy Inverso Nginx
- **Backend:** En produccion se ejecuta con **Gunicorn** (`core.wsgi:application`) utilizando 3 procesos worker independientes para atender multiples solicitudes concurrentes sin bloqueos (`--timeout 120`).
- **Frontend:** Construccion multi-etapa en [`frontend/Dockerfile.prod`](file:///home/benjamin/Documentos/%20Sistema%20de%20Autoservicio%20para%20Colaboradores%20mediante%20Agentes%20Conversacionales/proyecto/frontend/Dockerfile.prod) (etapa 1 con `node:22-alpine` para `npm run build` y etapa 2 con `nginx:alpine`). Los argumentos de construccion `ARG` se reciben desde `docker-compose.prod.yml` y se incrustan en tiempo de compilacion en los bundles estaticos de React.
- **Nginx:** Escucha en el contenedor en el puerto `80`, sirve la aplicacion SPA con fallback a `index.html`, y actua como proxy inverso hacia `http://backend:8000/api/` y `http://backend:8000/media/avatares/`. En el anfitrion se mapea mediante `${FRONTEND_PORT:-80}:80`, permitiendo alternar el puerto externo (ej. a `8080`) si el puerto 80 esta ocupado por Apache u otro servidor web local.
- **Seguridad de Red:** Los puertos de PostgreSQL (`5432`) y Redis (`6379`) no se exponen al exterior en produccion, manteniendose estrictamente en la red interna aislada de Docker.

### 5. Estado de la Cache de Redis
Respecto a la memoria cache de Redis (`REDIS_URL`): se encuentra configurada en [`core/settings.py`](file:///home/benjamin/Documentos/%20Sistema%20de%20Autoservicio%20para%20Colaboradores%20mediante%20Agentes%20Conversacionales/proyecto/backend/core/settings.py) como infraestructura para sesiones y almacenamiento en memoria (`django.core.cache.backends.redis.RedisCache`). En la version actual del codigo, ninguna vista ni servicio realiza llamadas directas a `cache.get()` o `cache.set()`, por lo que opera actualmente como soporte de infraestructura preparado para futuras politicas de almacenamiento en cache y colas asincronas.

### 6. Protecciones de Concurrencia y Seguridad en Backend
- **Creacion Segura de Vacaciones:** En [`hr_services/services.py`](file:///home/benjamin/Documentos/%20Sistema%20de%20Autoservicio%20para%20Colaboradores%20mediante%20Agentes%20Conversacionales/proyecto/backend/hr_services/services.py), la funcion `crear_solicitud_vacaciones` implementa `transaction.atomic()` y bloqueo pesimista con `select_for_update()` sobre el registro del empleado, evitando condiciones de carrera por solicitudes simultaneas (ej. solicitud via chat y via formulario web al mismo instante).
- **Filtro Estricto de Roles en Auth0:** En [`authentication/auth0.py`](file:///home/benjamin/Documentos/%20Sistema%20de%20Autoservicio%20para%20Colaboradores%20mediante%20Agentes%20Conversacionales/proyecto/backend/authentication/auth0.py), la extraccion de roles verifica con exactitud `key.endswith('/roles')` o `key == 'roles'`, impidiendo la inyeccion indebida de claims arbitrarios que contengan la subcadena 'role'.
- **Modularizacion de Vistas de Recursos Humanos:** El modulo de vistas fue dividido en dos controladores especializados: `views_colaborador.py` (portal de autoservicio) y `views_rh.py` (administracion y backoffice de RH), manteniendo una fachada en `views.py` que re-exporta los simbolos para total compatibilidad.
- **Seguridad en Constancias y Archivos Multimedia:** En [`core/urls.py`](file:///home/benjamin/Documentos/%20Sistema%20de%20Autoservicio%20para%20Colaboradores%20mediante%20Agentes%20Conversacionales/proyecto/backend/core/urls.py) unicamente se sirve de manera publica la ruta `/media/avatares/` para visualizar fotos de perfil. El directorio de constancias laborales (`/media/constancias/`) esta protegido: Nginx bloquea cualquier acceso directo fuera de avatares con `403 Forbidden` y Django no lo rutea (`404 Not Found`). La emision, previsualizacion y descarga de constancias se realiza exclusivamente a traves de `/api/hr/constancia/`, que requiere sesion autenticada obligatoria y valida la identidad del colaborador para prevenir filtracion de sueldos o datos personales.
- **Ergonomia del Asistente Virtual y Modales:** La vista del chat cuenta con bloqueo de altura a `100vh` en escritorio y `calc(100dvh - 56px)` en movil, con scrollbar interno en el contenedor de mensajes, manteniendo el formulario de entrada permanentemente anclado en pantalla sin desplazar la ventana principal del navegador. El modal de previsualizacion de PDF se renderiza mediante `createPortal` en `document.body` para garantizar centrado y seguimiento exacto en el viewport visible.

### 7. Receta completa para despliegue en produccion
Para compilar, inicializar y ejecutar el stack completo con las configuraciones optimizadas de produccion de punta a punta:

1. **Configurar el entorno de produccion:**
   Copia la plantilla de produccion:
   ```bash
   cp .env.prod.example .env
   ```
   - Define tu `GEMINI_API_KEY`, asigna una `SECRET_KEY` aleatoria de produccion y configura tus credenciales de Auth0 si vas a utilizar tu tenant en vivo. Asegurate de que `DEBUG=False` y `VITE_API_BASE_URL=/api`.
   - **Puerto del frontend (`FRONTEND_PORT`):** Por defecto se enlaza al puerto `80`. Si en tu equipo anfitrion el puerto 80 se encuentra ocupado por Apache u otro servicio local, define `FRONTEND_PORT=8080` en tu archivo `.env`.
   - *Nota de seguridad con Auth0:* Si cambias el puerto a `8080` y utilizas Auth0, recuerda registrar `http://localhost:8080` dentro de **Allowed Callback URLs**, **Allowed Logout URLs** y **Allowed Web Origins** en tu aplicacion de Auth0, y agregarlo a `CORS_ALLOWED_ORIGINS` si aplica.

2. **Compilar y levantar los contenedores de produccion:**
   ```bash
   docker compose -f docker-compose.prod.yml up --build -d
   ```

3. **Ejecutar migraciones en la base de datos PostgreSQL:**
   ```bash
   docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
   ```

4. **Poblar datos iniciales y base de conocimiento RAG:**
   ```bash
   docker compose -f docker-compose.prod.yml exec backend python manage.py poblar_datos_iniciales
   ```

5. **Verificar la suite de pruebas:**
   ```bash
   docker compose -f docker-compose.prod.yml exec backend python manage.py test
   ```

6. **Acceder a la aplicacion:**
   Ingresa desde tu navegador a [http://localhost](http://localhost) (o a `http://localhost:8080` si configuraste `FRONTEND_PORT=8080`). El trafico entrante se distribuira internamente entre el frontend estatico y el proxy inverso de la API en `/api/`.
