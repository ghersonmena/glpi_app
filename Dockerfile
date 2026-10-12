# Etapa 1: Build de la aplicación con Node.js
FROM node:22-alpine AS build

WORKDIR /app

# Copiar manifiestos de paquetes e instalar dependencias
COPY package.json package-lock.json ./
RUN npm ci

# Copiar el resto del código fuente
COPY . .

# Argumentos de compilación para variables de entorno .env en la compilación
ARG VITE_GLPI_URL
ARG VITE_GLPI_APP_TOKEN
ARG VITE_ENABLE_MOCK

ENV VITE_GLPI_URL=$VITE_GLPI_URL
ENV VITE_GLPI_APP_TOKEN=$VITE_GLPI_APP_TOKEN
ENV VITE_ENABLE_MOCK=$VITE_ENABLE_MOCK

# Compilar proyecto para producción
RUN npm run build

# Etapa 2: Servidor web ligero Nginx para producción
FROM nginx:alpine

# Copiar la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los archivos estáticos generados
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
