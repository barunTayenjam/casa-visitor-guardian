# PostgreSQL Database Dockerfile
FROM postgres:15-alpine

# Set environment variables
ENV POSTGRES_DB=sentryvision
ENV POSTGRES_USER=sentryvision
ENV POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-changeme}

# Expose port
EXPOSE 5432

# The default postgres entrypoint will handle database initialization