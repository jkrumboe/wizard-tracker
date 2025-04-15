FROM node:16

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

# Copy your backend code (from src/)
COPY src/ .

# Copy the wait-for-it script
COPY wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh

EXPOSE 5000

CMD ["sh", "/wait-for-it.sh", "db:5432", "--", "node", "index.js"]
