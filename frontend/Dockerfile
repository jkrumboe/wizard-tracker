# Stage 1: Build
FROM node:23-alpine AS build
WORKDIR /app
COPY . .
ARG VITE_APPWRITE_PUBLIC_ENDPOINT
ARG VITE_APPWRITE_PROJECT_ID
ENV VITE_APPWRITE_PUBLIC_ENDPOINT=$VITE_APPWRITE_PUBLIC_ENDPOINT
ENV VITE_APPWRITE_PROJECT_ID=$VITE_APPWRITE_PROJECT_ID
RUN npm install
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
