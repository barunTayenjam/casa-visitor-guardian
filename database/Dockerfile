# PostgreSQL Database Dockerfile
FROM postgres:15-alpine

# Set environment variables
ENV POSTGRES_DB=sentryvision
ENV POSTGRES_USER=sentryvision
ENV POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-changeme}

# Create additional directories for data persistence
RUN mkdir -p /var/lib/postgresql/data/events /var/lib/postgresql/data/snapshots

# Expose port
EXPOSE 5432

# The default postgres entrypoint will handle database initialization