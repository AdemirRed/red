# Dockerfile para CloudShare Pro Frontend (Vite + Vue)
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências (usar npm install se não tiver package-lock)
RUN npm install --legacy-peer-deps || npm ci --legacy-peer-deps

# Copiar código fonte
COPY . .

# Build de produção
RUN npm run build

# Stage 2: Serve com Nginx
FROM nginx:alpine AS runner

# Copiar build para nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuração nginx personalizada
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expor porta 80
EXPOSE 80

# Comando padrão do nginx
CMD ["nginx", "-g", "daemon off;"]