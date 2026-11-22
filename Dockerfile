# syntax=docker/dockerfile:1

# --- Etapa 1: Instalación de dependencias de producción ---
FROM node:22-alpine AS deps

WORKDIR /app

# Copiar únicamente manifiestos para aprovechar la caché de capas
COPY package.json package-lock.json* ./

# Instalar solo dependencias de producción de forma determinista
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# --- Etapa 2: Imagen final de ejecución ---
FROM node:22-alpine AS runner

WORKDIR /app

# Variables base de entorno para Node.js
ENV NODE_ENV=production
ENV PORT=3000

# Copiar dependencias ya resueltas desde la etapa deps
COPY --from=deps /app/node_modules ./node_modules

# Copiar código fuente de la aplicación
COPY package.json ./
COPY src ./src

# Asegurar permisos para el usuario no-root incluido en la imagen oficial
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Verificar que el proceso Node responda en su endpoint de salud
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Arrancar el servidor
CMD ["node", "src/server.js"]