# academy-rh

Sistema de Autoservicio para Colaboradores mediante Agentes Conversacionales.

Plataforma de Inteligencia Artificial para la gestión y atención automatizada de servicios de Recursos Humanos en **PluriOne S.A. de C.V. (Develop Talent & Technology)**.

---

## 🛠️ Tech Stack

- **Backend:** Python 3.12, Django / Django REST Framework, LangChain, LangGraph, Google AI Studio (Gemini API)
- **Frontend:** React.js (Vite), CSS OKLCH Custom Design Tokens
- **Base de Datos & Caché:** PostgreSQL, Redis
- **DevOps & Despliegue:** Docker, Docker Compose, GitHub Actions

---

## 🚀 Instalación y Configuración Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/gatoAmaranto/academy-rh.git
cd academy-rh
```

### 2. Configurar Variables de Entorno
Copia el archivo de plantilla `.env.example` a `.env` y agrega tu `GEMINI_API_KEY`:

```bash
cp .env.example .env
```
Abre `.env` y asigna tu API Key:
```env
GEMINI_API_KEY=tu_api_key_de_google_ai_studio
```

### 3. Ejecutar con Docker Compose
```bash
docker compose up --build
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:8000](http://localhost:8000)
- **Django Admin:** [http://localhost:8000/admin/](http://localhost:8000/admin/)

---

## 📄 Documentación del Proyecto

- [Product Requirement Document (PRD)](./docs/PRD.md)
- [Especificación del MVP](./docs/MVP.md)

---

*Desarrollado para PluriOne S.A. de C.V. — 2026*
