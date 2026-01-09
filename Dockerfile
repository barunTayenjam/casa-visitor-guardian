FROM node:20-alpine

# Install all system dependencies needed for SentryVision
RUN apk add --no-cache \
    postgresql \
    postgresql-contrib \
    ffmpeg \
    python3 \
    py3-pip \
    make \
    g++ \
    git \
    curl \
    pkgconfig \
    libpng-dev \
    libjpeg-turbo-dev \
    py3-opencv \
    py3-numpy \
    lsof \
    opencv-dev \
    cmake \
    gfortran \
    build-base \
    && rm -rf /var/cache/apk*

# Start PostgreSQL service
RUN apk add --no-cache postgresql postgresql-contrib && \
    mkdir -p /run/postgresql && \
    chown -R postgres:postgres /run/postgresql && \
    chmod 770 /run/postgresql && \
    su - postgres -c "initdb -D /var/lib/postgresql/data" && \
    su - postgres -c "pg_ctl -D /var/lib/postgresql/data -l logfile start" && \
    sleep 5 && \
    su - postgres -c "createdb sentryvision" && \
    su - postgres -c "createuser sentryvision" && \
    su - postgres -c "psql -c \"ALTER USER sentryvision WITH PASSWORD 'sentryvision123'\"" && \
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE sentryvision TO sentryvision\"" && \
    pg_ctl -D /var/lib/postgresql/data stop

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY database/package*.json ./database/

# Install dependencies
RUN npm install
RUN cd server && npm install
RUN cd database && npm install

# Copy source code
COPY . .

# Create data directories
RUN mkdir -p /app/data/events /app/data/snapshots /app/public/events /app/public/events/temp

# Expose ports
EXPOSE 5173 8082

# Environment variables
ENV NODE_ENV=development

# Start PostgreSQL and the development server
CMD ["sh", "-c", "su - postgres -c \"pg_ctl -D /var/lib/postgresql/data -l logfile start\" && sleep 5 && cd server && npm run dev & cd /app && npm run dev"]