# Docker Setup Guide

This project includes Docker configuration for both frontend and backend services.

## 📦 Project Structure

- **Frontend**: React + Vite application (Nginx in production)
- **Backend**: Node.js Express server with Python image processing

## 🚀 Quick Start

### Using Docker Compose (Recommended)

Build and start all services:
```bash
docker-compose up --build
```

Start services in detached mode:
```bash
docker-compose up -d
```

Stop services:
```bash
docker-compose down
```

Stop services and remove volumes:
```bash
docker-compose down -v
```

### Building Individual Services

**Frontend:**
```bash
cd frontend
docker build -t tshirt-frontend .
docker run -p 80:80 tshirt-frontend
```

**Backend:**
```bash
cd server
docker build -t tshirt-server .
docker run -p 3000:3000 tshirt-server
```

## 🌐 Access the Application

- **Frontend**: http://localhost (port 80)
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health

## 🛠️ Configuration

### Environment Variables

Create `.env` files if needed:

**Backend (.env in server/):**
```
PORT=3000
NODE_ENV=production
```

**Frontend (.env in frontend/):**
```
VITE_API_URL=http://localhost:3000
```

### Nginx Configuration

The frontend uses a custom Nginx configuration (`frontend/nginx.conf`) that:
- Enables SPA routing
- Proxies API requests to backend
- Adds security headers
- Enables gzip compression
- Sets cache headers for static assets

## 📋 Docker Commands Cheatsheet

```bash
# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f server
docker-compose logs -f frontend

# Restart a service
docker-compose restart server

# Rebuild without cache
docker-compose build --no-cache

# Remove unused images
docker image prune -a

# Execute command in running container
docker exec -it tshirt-server sh
```

## 🧹 Cleanup

Remove all containers and images:
```bash
docker-compose down --rmi all -v
```

## 📝 Notes

- The backend includes Python 3 and required libraries (rembg, Pillow, requests) for image processing
- Output images are stored in `tshirt_recolor_output/` directory (mounted as volume)
- Frontend is optimized for production with multi-stage build
- Both services are connected via a bridge network

## 🔧 Troubleshooting

**Port already in use:**
```bash
# Find process using the port
lsof -i :3000
lsof -i :80

# Or change ports in docker-compose.yml
```

**Python dependencies failing:**
The backend image uses `node:20-bullseye` which includes system libraries needed for image processing.

**Frontend not connecting to backend:**
Make sure the API URL in your frontend code points to the correct backend URL.
