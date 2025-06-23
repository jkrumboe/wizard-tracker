FROM node:23-alpine

# Create a non-root user and group
RUN addgroup -g 12641 -S appgroup && \
    adduser -u 12642 -S appuser -G appgroup

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --production

# Copy application source code
COPY src/ .

# Set ownership of application files
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

EXPOSE 5000

CMD ["node", "index.js"]