# Stage 1: Build
FROM node:20 AS build
WORKDIR /app

# Accept build argument
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm install
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy build files
COPY --from=build /app/dist /usr/share/nginx/html

# Copy the template
COPY env-config.js.template /usr/share/nginx/html/env-config.js.template

# Install envsubst
RUN apk add --no-cache gettext

# Replace placeholders with environment variables
CMD ["/bin/sh", "-c", "envsubst < /usr/share/nginx/html/env-config.js.template > /usr/share/nginx/html/env-config.js && exec nginx -g 'daemon off;'"]

