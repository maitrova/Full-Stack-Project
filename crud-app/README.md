# CRUD Application Helm Chart

This Helm chart deploys a full-stack CRUD application with React frontend, Node.js backend, and MongoDB database.

## Prerequisites

- Kubernetes cluster (K3s, EKS, GKE, AKS, etc.)
- Helm 3.x installed
- kubectl configured
- Nginx Ingress Controller installed
- cert-manager installed (for SSL certificates)

## Installation

### 1. Update values.yaml

Edit `values.yaml` and update:

```yaml
global:
  domain: your-domain.com  # Change to your domain

backend:
  image:
    repository: your-registry/crud-backend  # Your backend image
    tag: latest

frontend:
  image:
    repository: your-registry/crud-frontend  # Your frontend image
    tag: latest

ingress:
  hosts:
    - host: your-domain.com
    - host: api.your-domain.com
```

### 2. Install the Chart

```bash
# Install with default values
helm install crud-app ./crud-app

# Install with custom values
helm install crud-app ./crud-app -f custom-values.yaml

# Install in specific namespace
helm install crud-app ./crud-app --namespace production --create-namespace
```

### 3. Verify Installation

```bash
# Check pods
kubectl get pods

# Check services
kubectl get svc

# Check ingress
kubectl get ingress

# Check persistent volumes
kubectl get pvc
```

## Configuration

### Backend Configuration

```yaml
backend:
  enabled: true
  replicaCount: 2
  image:
    repository: your-registry/crud-backend
    tag: latest
  envSecrets:
    MONGODB_URI: "mongodb://mongodb-service:27017/crud-app"
  resources:
    limits:
      cpu: "1"
      memory: 1Gi
```

### Frontend Configuration

```yaml
frontend:
  enabled: true
  replicaCount: 2
  image:
    repository: your-registry/crud-frontend
    tag: latest
  resources:
    limits:
      cpu: "500m"
      memory: 512Mi
```

### MongoDB Configuration

```yaml
mongodb:
  enabled: true
  persistence:
    enabled: true
    size: 10Gi
  resources:
    limits:
      cpu: "1"
      memory: 2Gi
```

## Scaling

### Manual Scaling

```bash
# Scale backend
kubectl scale deployment backend --replicas=5

# Scale frontend
kubectl scale deployment frontend --replicas=5
```

### Auto Scaling (HPA)

Autoscaling is enabled by default:
- Backend: 2-5 replicas at 70% CPU
- Frontend: 2-5 replicas at 70% CPU

## Accessing the Application

After installation with ingress:
- Frontend: https://your-domain.com
- Backend API: https://api.your-domain.com/api

## Uninstallation

```bash
# Uninstall the release
helm uninstall crud-app

# Delete persistent volumes (optional)
kubectl delete pvc -l app.kubernetes.io/name=mongodb
```

## Upgrading

```bash
# Upgrade to new version
helm upgrade crud-app ./crud-app

# Upgrade with new values
helm upgrade crud-app ./crud-app -f new-values.yaml

# Rollback if needed
helm rollback crud-app
```

## Monitoring

### Check Logs

```bash
# Backend logs
kubectl logs -f deployment/backend

# Frontend logs
kubectl logs -f deployment/frontend

# MongoDB logs
kubectl logs -f statefulset/mongodb
```

### Health Checks

All services have liveness and readiness probes configured.

## Troubleshooting

### Pods not starting

```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

### Database connection issues

```bash
# Check MongoDB is running
kubectl get pods -l app.kubernetes.io/name=mongodb

# Check service
kubectl get svc mongodb-service

# Test connection from backend pod
kubectl exec -it <backend-pod> -- mongosh mongodb://mongodb-service:27017/crud-app
```

### Ingress not working

```bash
# Check ingress controller
kubectl get pods -n ingress-nginx

# Check ingress resource
kubectl describe ingress crud-app-ingress

# Check TLS certificate
kubectl describe certificate narifighter-tls
```

## Production Considerations

1. **Secrets Management**: Use external secrets manager (AWS Secrets Manager, Vault, etc.)
2. **Image Registry**: Use private registry with pull secrets
3. **Backup**: Set up MongoDB backup strategy
4. **Monitoring**: Integrate with Prometheus/Grafana
5. **SSL Certificates**: Ensure cert-manager is properly configured
6. **Resource Limits**: Adjust based on your workload
7. **High Availability**: Run multiple replicas across availability zones

## License

MIT
