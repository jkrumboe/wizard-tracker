FROM node:23-alpine

# Install bash for wait-for-it.sh
RUN apk add --no-cache bash

# Create a non-root user and group
RUN addgroup -g 12641 -S appgroup && \
    adduser -u 12642 -S appuser -G appgroup

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --production

# Copy application source code
COPY src/ .

# Copy and set permissions for wait-for-it.sh
COPY wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh

# Set ownership of application files
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

EXPOSE 5000

CMD ["bash", "/wait-for-it.sh", "db:5432", "--", "node", "index.js"]