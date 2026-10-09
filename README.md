# Sistema de Autoservicio para Colaboradores mediante Agentes Conversacionales (PluriOne)

Plataforma institucional de Inteligencia Artificial para la gestion, atencion automatizada y autoservicio de Recursos Humanos en **PluriOne S.A. de C.V. (Develop Talent & Technology)**.

---

## Descripcion General

El sistema proporciona un canal de comunicacion inteligente y un entorno web administrativo que optimiza las solicitudes mas recurrentes del personal:
- Consulta y solicitud formal de dias de descanso vacacional con validacion de saldos.
- Emision automatizada de constancias laborales membretadas en formato PDF con firma institucional.
- Registro, canalizacion y seguimiento de tickets de soporte con respuesta resolutiva oficial.
- Resolucion de dudas frecuentes mediante un motor RAG alimentado con reglamentos y politicas internas.
- Expediente digital de colaboradores y personal de RH con administracion de fotografia de perfil.
- Control de acceso basado en roles (RBAC) con inicio de sesion unico (SSO) mediante Auth0.

---

## Arquitectura y Stack Tecnologico

### Backend
- **Lenguaje y Framework:** Python 3.12, Django 5.x, Django REST Framework.
- **Motor de Inteligencia Artificial:** Google AI Studio SDK (`google-genai`) empleando `gemini-3.8-flash` con cascada de contingencia a `gemini-3.6-flash`.
- **Persistencia Conversacional:** Modelo relacional `MensajeChat` vinculado a la entidad `Empleado`.
- **Generacion de Documentos:** ReportLab para constancias laborales en formato PDF con membrete y sello digital.
- **Procesamiento de Documentos RAG:** PyPDF para extraccion de texto y segmentacion automatica (chunking) de archivos `.pdf`, `.txt` y `.md`.
- **Seguridad:** Autenticacion JWT Bearer contra Auth0 con verificacion de firma criptografica RS256 mediante JWKS y fallback a tokens mock para desarrollo local.

### Frontend
- **Framework y Bundler:** React 18, Vite.
- **Navegacion y Diseno:** Arquitectura de navegacion lateral (Sidenavbar) para los portales de Colaborador y Backoffice de RH.
- **Iconografia:** Lucide React (estilo institucional sobrio, sin emojis).
- **Sistema de Diseno:** Tokens CSS basados en el espacio de color OKLCH con soporte completo para modo claro y modo oscuro, incluyendo deteccion automatica de la preferencia del sistema operativo.
- **Cliente HTTP:** Axios con interceptor centralizado para inyeccion de tokens Bearer y gestion de autorizaciones.

### Base de Datos, Cache e Infraestructura
- **Base de Datos Principal:** PostgreSQL 16.
- **Cache y Mensajeria:** Redis 7.
- **Contenedores y Orquestacion:** Docker, Docker Compose.

---

## Modulos y Funcionalidades Principales

### 1. Portal del Colaborador (Navegacion Sidenavbar)
- **Asistente Virtual con IA:** Chat conversacional interactivo para solicitudes y dudas, con memoria persistente en base de datos y opcion de reinicio de sesion.
- **Mi Perfil Laboral:** Pantalla dedicada (sin ventanas modales) para consultar el expediente de trabajo (numero de empleado, puesto, departamento, fecha de contratacion, antiguedad calculada, salario mensual y saldo de vacaciones) y cargar o remover la fotografia de perfil institucional (formato multipart).
- **Mis Vacaciones:** Indicador en tiempo real de dias disponibles, formulario interactivo para registrar solicitudes y tabla de historial con estatus dictaminado.
- **Mis Tickets de Soporte:** Listado de folios (`TK-XXXXXXXX`), estatus de atencion y visualizacion destacada del dictamen oficial emitido por Recursos Humanos.
- **Constancia Laboral Membretada:** Configurador de destinatario, inclusion opcional de sueldo, visor previo en pantalla y descarga directa en PDF oficial.

### 2. Backoffice de Recursos Humanos (Navegacion Sidenavbar)
- **Aprobacion y Dictaminacion de Vacaciones:** Panel para aprobar o rechazar solicitudes de vacaciones, con descuento automatico de dias sobre el saldo del empleado.
- **Mesa de Ayuda y Atencion de Tickets:** Bandeja de incidencias con capacidad de registrar respuestas resolutivas y actualizar el estado a `RESUELTO`.
- **Base de Conocimiento RAG & FAQs:** Carga directa de reglamentos corporativos en formato PDF, TXT o Markdown con ingesta y vectorizacion inmediata, asi como administracion manual de preguntas y respuestas frecuentes.
- **Mi Perfil RH:** Ficha del funcionario institucional, actualizacion de fotografia de perfil, matriz de autorizaciones y control de beneficio vacacional propio.

---

## Instalacion y Despliegue Local

### Prerrequisitos
- Docker Engine 24+ y Docker Compose v2+.
- Git.
- Clave de API de Google AI Studio (Gemini API Key).

### 1. Clonar el Repositorio
```bash
git clone https://github.com/gatoAmaranto/academy-rh.git
cd academy-rh/proyecto
```

### 2. Configurar Variables de Entorno
Copia el archivo de plantilla `.env.example` para generar tu archivo `.env`:

```bash
cp .env.example .env
```

Edita el archivo `.env` y coloca tu API Key de Google AI Studio:
```env
GEMINI_API_KEY=tu_api_key_de_google_ai_studio
```

Las variables de PostgreSQL, Redis y Auth0 ya se encuentran preconfiguradas con valores funcionales para desarrollo local.

### 3. Iniciar Servicios con Docker Compose
Ejecuta el siguiente comando en la raiz del proyecto:

```bash
docker compose up --build -d
```

Este comando levantara cuatro servicios en contenedores:
1. `hr_postgres_db`: Base de datos PostgreSQL en el puerto `5432`.
2. `hr_redis_cache`: Servidor de cache Redis en el puerto `6379`.
3. `hr_django_backend`: Servidor de aplicaciones Django en el puerto `8000`.
4. `hr_react_frontend`: Servidor de desarrollo Vite en el puerto `5173`.

### 4. Accesos a la Aplicacion
- **Portal Web (Frontend React):** [http://localhost:5173](http://localhost:5173)
- **API REST (Backend Django):** [http://localhost:8000/api/](http://localhost:8000/api/)
- **Panel Administrativo Django:** [http://localhost:8000/admin/](http://localhost:8000/admin/)

---

## Usuarios de Prueba y Roles de Autenticacion

La aplicacion soporta autenticacion directa mediante Auth0 SSO y modo simulado para pruebas locales:

### Modo Simulado Local (Switcher en cabecera)
- **Rol Colaborador:**
  - Usuario: `demo_colaborador`
  - Nombre: Juan Perez
  - Puesto: Desarrollador Full Stack
  - Acceso: Portal del Colaborador (chat, perfil, vacaciones, tickets y constancias).
- **Rol Recursos Humanos:**
  - Usuario: `demo_rh_admin`
  - Nombre: Maria Rodriguez
  - Puesto: Directora de Talent & RH
  - Acceso: Backoffice RH (aprobacion de vacaciones, resolucion de tickets, entrenamiento RAG y perfil RH).

---

## Catalogo de Endpoints Principales

### Servicios de Recursos Humanos (`/api/hr/`)
- `GET /api/hr/perfil/` — Consulta el perfil laboral del empleado autenticado.
- `PATCH /api/hr/perfil/` — Actualiza datos del perfil o carga de fotografia de perfil.
- `POST /api/hr/perfil/avatar/` — Carga y procesamiento de avatar institucional (multipart).
- `DELETE /api/hr/perfil/avatar/` — Eliminacion de fotografia de perfil.
- `GET /api/hr/vacaciones/` — Consulta saldo de vacaciones e historial de solicitudes del colaborador.
- `POST /api/hr/vacaciones/` — Registro de nueva solicitud de vacaciones.
- `GET /api/hr/constancia/` — Obtiene o genera la constancia laboral en PDF para visor previo o descarga.
- `POST /api/hr/constancia/` — Genera constancia laboral con parametros personalizados (sueldo, destinatario).
- `GET /api/hr/tickets/` — Listado de tickets del colaborador autenticado.
- `POST /api/hr/tickets/` — Apertura de un nuevo ticket de soporte con folio generado.

### Backoffice Administrativo (`/api/hr/admin/`)
- `GET /api/hr/admin/perfil/` — Consulta el perfil institucional del funcionario de RH.
- `POST /api/hr/admin/perfil/avatar/` — Actualiza el avatar del funcionario de RH.
- `GET /api/hr/admin/vacaciones/` — Listado general de solicitudes de vacaciones de la organizacion.
- `PATCH /api/hr/admin/vacaciones/<id>/` — Dictamina una solicitud (`APROBADO` / `RECHAZADO`).
- `GET /api/hr/admin/tickets/` — Listado general de tickets recibidos.
- `PATCH /api/hr/admin/tickets/<id>/` — Responde formalmente a un ticket y actualiza su estado.
- `GET /api/hr/admin/faq/` — Listado de preguntas frecuentes activas para el motor RAG.
- `POST /api/hr/admin/faq/` — Creacion manual de nueva pregunta en la base de conocimientos.
- `DELETE /api/hr/admin/faq/<id>/` — Activa o desactiva una pregunta frecuente.
- `POST /api/hr/admin/faq/upload/` — Ingesta de documentos `.pdf`, `.txt` o `.md` para la base RAG.

### Agente Conversacional (`/api/agent/`)
- `POST /api/agent/chat/` — Envia un mensaje al agente conversacional de Gemini con enrutamiento de intenciones.
- `GET /api/agent/historial/` — Recupera los mensajes previos de la sesion del colaborador.
- `DELETE /api/agent/historial/` — Reinicia el historial conversacional del usuario.

---

## Ejecucion de Pruebas Automatizadas

Para validar la integridad de la base de datos, APIs y componentes del sistema:

### Pruebas Unitarias del Backend (Django)
```bash
docker compose exec backend python manage.py test
```

Para ejecutar pruebas por modulo individual:
```bash
docker compose exec backend python manage.py test hr_services
docker compose exec backend python manage.py test ai_agents
```

### Compilacion de Produccion del Frontend (Vite)
```bash
cd frontend && npm run build
```

---

## Documentacion Adicional

- [Documento de Requerimientos de Producto (PRD)](./docs/PRD.md)
- [Especificacion del Producto Minimo Viable (MVP)](./docs/MVP.md)

---

PluriOne S.A. de C.V. — Develop Talent & Technology — 2026
