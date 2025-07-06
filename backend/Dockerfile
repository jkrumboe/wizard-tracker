FROM node:23-alpine

# Create a non-root user and group
RUN addgroup -g 12641 -S appgroup && \
    adduser -u 12642 -S appuser -G appgroup

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --production

# Create all needed config directories
RUN mkdir -p /app/src/config /app/config

# Copy application source code
COPY src/ /app/src/

# Set up initial config files in both locations
RUN echo '{"online":false,"lastUpdated":"2025-07-06T00:00:00.000Z","reason":"Initial setup - offline mode"}' > /app/src/config/online-status.json && \
    echo '{"online":false,"lastUpdated":"2025-07-06T00:00:00.000Z","reason":"Initial setup - offline mode"}' > /app/config/online-status.json

# Set ownership of application files
RUN chown -R appuser:appgroup /app

# Expose API port
EXPOSE 5055

# Switch to non-root user for running the application
USER appuser

CMD ["node", "src/index.js"]