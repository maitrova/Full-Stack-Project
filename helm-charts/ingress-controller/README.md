# Ingress Controller Helm Chart

This Helm chart manages the ingress resources for the full-stack application, providing external access to backend and frontend services.

## Overview

This chart creates and manages Kubernetes Ingress resources for:
- **Backend API**: Routes `/api` paths to the backend service
- **Frontend**: Routes root path `/` to the frontend service
- **Images Endpoint**: (Optional) Routes `/images` paths with URL rewriting
- **Combined Ingress**: (Optional) Single ingress for all services with path-based routing

## Features

- ✅ NGINX Ingress controller support
- ✅ Automatic TLS/SSL certificate management via cert-manager
- ✅ Configurable annotations for advanced routing
- ✅ Support for multiple ingress strategies (separate or combined)
- ✅ Flexible service name and port configuration

## Prerequisites

- Kubernetes cluster (v1.19+)
- Helm 3.x
- NGINX Ingress Controller installed in the cluster
- cert-manager installed for automatic TLS certificate management (optional but recommended)

## Installation

### Basic Installation

```bash
helm install ingress-controller ./ingress-controller
```

### Custom Installation

```bash
helm install ingress-controller ./ingress-controller \
  --set global.domain=yourdomain.com \
  --set backend.serviceName=your-backend-service \
  --set frontend.serviceName=your-frontend-service
```

### Installation with Custom Values

```bash
helm install ingress-controller ./ingress-controller -f custom-values.yaml
```

## Configuration

### Global Settings

| Parameter | Description | Default |
|-----------|-------------|---------|
| `global.domain` | Primary domain name | `narifighter.online` |
| `global.environment` | Environment name | `production` |

### Backend Ingress

| Parameter | Description | Default |
|-----------|-------------|---------|
| `backend.enabled` | Enable backend ingress | `true` |
| `backend.name` | Backend name for resource naming | `backend` |
| `backend.serviceName` | Kubernetes service name for backend | `backend-service` |
| `backend.servicePort` | Service port number | `5000` |
| `backend.ingress.enabled` | Enable backend ingress resource | `true` |
| `backend.ingress.className` | Ingress class name | `nginx` |
| `backend.ingress.annotations` | Ingress annotations | See values.yaml |
| `backend.ingress.hosts` | Host and path configuration | See values.yaml |
| `backend.ingress.tls` | TLS configuration | See values.yaml |

### Frontend Ingress

| Parameter | Description | Default |
|-----------|-------------|---------|
| `frontend.enabled` | Enable frontend ingress | `true` |
| `frontend.name` | Frontend name for resource naming | `frontend` |
| `frontend.serviceName` | Kubernetes service name for frontend | `frontend-service` |
| `frontend.servicePort` | Service port number | `80` |
| `frontend.ingress.enabled` | Enable frontend ingress resource | `true` |
| `frontend.ingress.className` | Ingress class name | `nginx` |
| `frontend.ingress.annotations` | Ingress annotations | See values.yaml |
| `frontend.ingress.hosts` | Host and path configuration | See values.yaml |
| `frontend.ingress.tls` | TLS configuration | See values.yaml |

### Images Ingress (Optional)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `backend.imagesIngress.enabled` | Enable images ingress | `false` |
| `backend.imagesIngress.className` | Ingress class name | `nginx` |
| `backend.imagesIngress.annotations` | Ingress annotations with URL rewriting | See values.yaml |

### Combined Ingress (Optional)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `combinedIngress.enabled` | Enable combined ingress for all services | `false` |
| `combinedIngress.className` | Ingress class name | `nginx` |
| `combinedIngress.annotations` | Ingress annotations | See values.yaml |

## Usage Examples

### Example 1: Separate Ingress Resources (Default)

This is the recommended approach with separate ingress resources for each service:

```yaml
backend:
  enabled: true
  ingress:
    enabled: true

frontend:
  enabled: true
  ingress:
    enabled: true

combinedIngress:
  enabled: false
```

### Example 2: Combined Ingress Resource

Use a single ingress resource for all services:

```yaml
backend:
  enabled: true
  ingress:
    enabled: false

frontend:
  enabled: true
  ingress:
    enabled: false

combinedIngress:
  enabled: true
```

### Example 3: Custom Domain and TLS

```yaml
global:
  domain: example.com

backend:
  ingress:
    hosts:
      - host: api.example.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: api-example-tls
        hosts:
          - api.example.com

frontend:
  ingress:
    hosts:
      - host: example.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: example-tls
        hosts:
          - example.com
```

## Upgrade

```bash
helm upgrade ingress-controller ./ingress-controller -f values.yaml
```

## Uninstall

```bash
helm uninstall ingress-controller
```

## Troubleshooting

### 1. Ingress Not Working

Check if NGINX Ingress Controller is installed:
```bash
kubectl get pods -n ingress-nginx
```

### 2. TLS Certificate Issues

Check cert-manager status:
```bash
kubectl get pods -n cert-manager
kubectl get certificates
kubectl describe certificate <certificate-name>
```

### 3. View Ingress Resources

```bash
kubectl get ingress
kubectl describe ingress <ingress-name>
```

### 4. Check Ingress Logs

```bash
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
```

## Architecture

This chart follows a modular approach where ingress resources are separate from application deployments, allowing for:
- Independent management of routing rules
- Easy updates to ingress configuration without affecting applications
- Flexibility to switch between different ingress strategies
- Better separation of concerns

## Notes

- The chart assumes services are already deployed (backend-service, frontend-service)
- TLS certificates are automatically provisioned if cert-manager is installed
- The default configuration uses separate ingress resources for better isolation
- Path-based routing uses NGINX-specific annotations for URL rewriting

## Support

For issues and questions, please refer to the project documentation or create an issue in the repository.
