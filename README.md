# 📱 GLPI Mobile App

Una aplicación móvil web moderna, responsiva y empaquetada en Docker para conectarse a la API de **GLPI (Gestionnaire Libre de Parc Informatique)**.

---

## 🚀 Características

- 🔐 **Vista de Inicio de Sesión (Login)**: Autenticación nativa utilizando las credenciales de tu GLPI (Usuario / Contraseña o Token de Usuario `user_token`).
- ⚡ **Configuración por `.env`**: Carga automática de la URL base del servidor GLPI y el `App-Token`.
- 📋 **Gestión de Tickets**: Listado en tiempo real con buscador inteligente y filtrado rápido por estado (Nuevo, En curso, En espera, Resuelto).
- 💬 **Seguimiento e Historial (ITIL Followups)**: Revisa los comentarios de cada ticket y envía respuestas directamente a GLPI.
- ➕ **Creación de Tickets**: Formulario para radicar nuevas incidencias seleccionando el nivel de urgencia.
- 📊 **Dashboard & Métricas**: Vista resumida de tickets con indicadores clave de rendimiento (KPIs).
- 🐳 **Soporte Docker & Docker Compose**: Despliegue listo para producción con Nginx y soporte de cabeceras CORS.
- 🧪 **Modo Sandbox / Demo**: Permite probar la interfaz móvil y todas las vistas sin necesidad de estar conectado a un GLPI activo en ese momento.

---

## 📁 Archivo de Variables de Entorno `.env`

Crea un archivo `.env` en la raíz del proyecto (basado en el archivo `.env.example` provisto):

```env
# URL base de tu servidor GLPI (ejemplo: https://glpi.tuempresa.com)
VITE_GLPI_URL=http://localhost/glpi

# Token de aplicación generado en GLPI (Configuración -> API)
VITE_GLPI_APP_TOKEN=tu_app_token_aqui

# Habilitar modo Demo en caso de pruebas offline (true/false)
VITE_ENABLE_MOCK=false
```

---

## ⚙️ Cómo obtener los tokens en GLPI

1. **App-Token**:
   - Inicia sesión como administrador en tu panel de GLPI.
   - Ve a **Configuración** -> **API**.
   - Habilita el cliente API HTTP y crea/copia el **Token de aplicación (App-Token)**.
2. **User-Token** (Opcional si usas usuario/contraseña):
   - Ve a la ficha de tu perfil de usuario en GLPI (esquina superior derecha).
   - En la pestaña **Claves de acceso API**, genera tu **Token de usuario (User-Token)**.

---

## 🛠️ Ejecución Local para Desarrollo

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Iniciar el servidor de desarrollo:
   ```bash
   npm run dev
   ```

3. Abrir el navegador en `http://localhost:5173`.

---

## 🐳 Ejecución con Docker

### Opción 1: Usando Docker Compose (Recomendado)

```bash
docker-compose up --build -d
```

La aplicación estará disponible en: **`http://localhost:8080`**

### Opción 2: Usando Docker CLI directamente

```bash
docker build -t glpi-mobile-app .
docker run -d -p 8080:80 --name glpi_app glpi-mobile-app
```

---

## 🏛️ Estructura del Proyecto

```
glpi_app/
├── src/
│   ├── components/
│   │   ├── BottomNav.tsx      # Navegación inferior tipo App Móvil
│   │   ├── CreateTicket.tsx   # Formulario de creación de ticket
│   │   ├── Dashboard.tsx      # Métricas e indicadores
│   │   ├── Header.tsx         # Barra superior y usuario
│   │   ├── Login.tsx          # Pantalla de Login GLPI
│   │   ├── Settings.tsx       # Configuración y temas
│   │   ├── TicketDetail.tsx   # Detalle de ticket y seguimientos
│   │   └── TicketList.tsx     # Listado con filtros y buscador
│   ├── services/
│   │   └── glpiService.ts     # Cliente API REST de GLPI (/initSession, /Ticket, etc.)
│   ├── types/
│   │   └── glpi.ts            # Definiciones de TypeScript
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── .env.example
├── .env
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── README.md
```
