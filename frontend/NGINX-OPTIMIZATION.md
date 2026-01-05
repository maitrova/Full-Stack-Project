# Frontend Optimization with Nginx

This document describes the nginx-based optimization implemented for the frontend service.

## Changes Made

### 1. Multi-stage Dockerfile
- **Before**: Single-stage Node.js image running `npm run dev` (development server)
- **After**: Multi-stage build with optimized nginx serving static assets

### 2. Image Size Reduction
- **Before**: ~1GB+ (full Node.js runtime + dependencies)
- **After**: ~50MB (nginx alpine + built assets)

### 3. Performance Improvements
- **Nginx**: High-performance web server optimized for static content
- **Gzip compression**: Enabled for all text assets
- **Caching headers**: Aggressive caching for static assets
- **Security headers**: Added security headers for better protection

### 4. Environment Variable Handling
The build process now supports runtime environment variable substitution:
- `VITE_API_URL` is replaced at container startup
- Uses placeholders during build, real values at runtime

## Files Added/Modified

### New Files:
- `nginx.conf` - Nginx configuration optimized for React apps
- `docker-entrypoint.sh` - Script to handle environment variable substitution
- `Dockerfile.dev` - Development Dockerfile for local development
- `build-and-test.sh` - Build and test automation script

### Modified Files:
- `Dockerfile` - Multi-stage build with nginx
- `vite.config.js` - Added build optimizations and environment handling
- `.dockerignore` - Comprehensive exclusion list
- `helm-charts/frontend/values.yaml` - Updated for nginx (port 80, health checks, resource limits)

## Usage

### Production Build
```bash
# Build the optimized image
docker build -t maitrova/maitrova:frontend .

# Run with environment variables
docker run -p 80:80 -e VITE_API_URL=https://narifighter.online/backend maitrova/maitrova:frontend
```

### Development Build
```bash
# Use development Dockerfile for local development
docker build -f Dockerfile.dev -t maitrova/maitrova:frontend-dev .
docker run -p 5173:5173 maitrova/maitrova:frontend-dev
```

### Test the Build
```bash
./build-and-test.sh
```

## Kubernetes Deployment

The helm chart has been updated to work with nginx:
- Service port changed from 5173 to 80
- Health checks enabled using `/health` endpoint
- Resource limits reduced (nginx is more efficient)
- Probes configured for nginx

## Benefits

1. **Smaller Image Size**: ~95% reduction in image size
2. **Better Performance**: Nginx is optimized for serving static content
3. **Enhanced Security**: Security headers and nginx security features
4. **Production Ready**: Proper caching, compression, and health checks
5. **Cost Effective**: Lower resource usage in Kubernetes

## Environment Variables

- `VITE_API_URL`: Backend API URL (currently: https://narifighter.online/backend)

The environment variable is substituted at runtime, allowing the same image to be used across different environments.