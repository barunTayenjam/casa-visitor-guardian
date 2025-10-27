# Quick Start Guide

## How to Run SentryVision

### Option 1: Automatic Startup (Recommended)
```bash
./start-docker.sh
```
Choose option **2** (Start with build) for first time setup.

### Option 2: Manual Startup
```bash
docker-compose up --build
```

### Option 3: Development Mode
```bash
docker-compose -f docker-compose.dev.yml up --build
```

## Access the Application

- **Main Application**: http://localhost:3020
- **Development Mode**: http://localhost:5173

## Configuration

The application uses these ports (configured in `.env`):
- Frontend: 3020
- Backend: 9753

To change ports, edit the `.env` file:
```bash
FRONTEND_PORT=3020
NGINX_PORT=3020
BACKEND_PORT=9753
```

## Stop the Application

```bash
docker-compose down
```

## Troubleshooting

If port 3020 is busy, the startup script will automatically try development mode on port 5173.

For other issues, check the logs:
```bash
docker-compose logs -f
```

That's it! The application should now be running and accessible.