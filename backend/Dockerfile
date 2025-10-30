FROM node:20-alpine

WORKDIR /app

# Install curl and openssl for Prisma
RUN apk add --no-cache curl openssl openssl-dev

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 3001

# Create entrypoint script
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'npx prisma migrate deploy' >> /entrypoint.sh && \
    echo 'npm run prisma:seed || true' >> /entrypoint.sh && \
    echo 'exec "$@"' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

# Start the application
CMD ["npm", "run", "dev"]

