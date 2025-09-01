# Stage 1: Build
FROM node:23-alpine AS build
WORKDIR /app
COPY . .
ARG VITE_APP_VERSION
ARG VITE_BUILD_DATE
ENV VITE_APP_VERSION=$VITE_APP_VERSION
ENV VITE_BUILD_DATE=$VITE_BUILD_DATE
RUN npm install
RUN npm run build:with-version

# Stage 2: Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
