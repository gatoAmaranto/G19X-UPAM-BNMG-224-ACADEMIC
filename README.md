# Instalacion y Ejecucion

Guia de configuracion y ejecucion del repositorio en entorno local.

---

## Prerrequisitos

- **Git**
- **Docker Engine** (v24 o superior)
- **Docker Compose** (v2 o superior)
- Clave de API de **Google AI Studio** (`GEMINI_API_KEY`)

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

Las variables para base de datos (PostgreSQL), cache (Redis) y autenticacion ya vienen configuradas con valores funcionales para desarrollo local.

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
