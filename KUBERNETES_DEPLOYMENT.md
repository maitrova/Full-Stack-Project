# Kubernetes Deployment Guide for narifighter.online

## Prerequisites Setup

### 1. Install Required Tools

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Verify installations
kubectl version --client
helm version
```

### 2. Setup K3s on VPS (if not already installed)

```bash
# SSH to your VPS
ssh root@narifighter.online

# Install K3s
curl -sfL https://get.k3s.io | sh -

# Copy kubeconfig to local machine
sudo cat /etc/rancher/k3s/k3s.yaml

# On your local machine, save the config
mkdir -p ~/.kube
# Paste the k3s.yaml content and replace 127.0.0.1 with your VPS IP
nano ~/.kube/config
```

### 3. Install Nginx Ingress Controller

```bash
# Install nginx ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml

# Verify installation
kubectl get pods -n ingress-nginx
kubectl get svc -n ingress-nginx
```

### 4. Install cert-manager (for SSL)

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl get pods -n cert-manager

# Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: narendrareddy00@gmail.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

## Build and Push Docker Images

### 1. Build Frontend Image

The frontend is configured to use `REACT_APP_API_URL=https://narifighter.online/api`

Build frontend image:
```bash
cd frontend
docker build --build-arg REACT_APP_API_URL=https://narifighter.online/api -t maitrova/crud-frontend:v1.0.0 .

# Push to Docker Hub (do this manually)
# docker push maitrova/crud-frontend:v1.0.0
```

### 2. Build Backend Image

```bash
cd backend
docker build -t maitrova/crud-backend:v1.0.0 .

# Push to Docker Hub (do this manually)
# docker push maitrova/crud-backend:v1.0.0
```

## Deploy Application

### 1. Update Helm Values

Edit `helm/crud-app/values-production.yaml`:
- Update `image.repository` with your Docker Hub username
- Verify domain names
- Adjust resource limits based on VPS specs

### 2. Install Helm Chart

```bash
# Create namespace
kubectl create namespace production

# Install the application
helm install crud-app ./helm/crud-app \
  -f ./helm/crud-app/values-production.yaml \
  --namespace production

# Watch deployment
kubectl get pods -n production -w
```

### 3. Verify Deployment

```bash
# Check all resources
kubectl get all -n production

# Check pods
kubectl get pods -n production

# Check services
kubectl get svc -n production

# Check ingress
kubectl get ingress -n production

# Check certificates
kubectl get certificate -n production

# Check logs
kubectl logs -f deployment/backend -n production
kubectl logs -f deployment/frontend -n production
```

## DNS Configuration

### Update DNS Records

Add this DNS record at your domain registrar:

```
Type  | Name | Value              | TTL
------|------|--------------------|----- 
A     | @    | YOUR_VPS_IP        | 300
```

Wait for DNS propagation (use `dig narifighter.online` to check).

## Verification

### 1. Test Endpoints

```bash
# Test frontend (once SSL is ready)
curl -I https://narifighter.online

# Test backend API (note the /api path)
curl https://narifighter.online/api/items

# Check certificate
curl -vI https://narifighter.online 2>&1 | grep -i subject
```

### 2. Access Application

Open browser and visit:
- Frontend: https://narifighter.online
- Backend API: https://narifighter.online/api/items

**Single domain with path-based routing:**
- `/` → Frontend (React app)
- `/api/*` → Backend (Node.js API)

## Monitoring and Maintenance

### View Logs

```bash
# Backend logs
kubectl logs -f deployment/backend -n production

# Frontend logs
kubectl logs -f deployment/frontend -n production

# MongoDB logs
kubectl logs -f statefulset/mongodb -n production

# Tail all logs
kubectl logs -f -l app.kubernetes.io/instance=crud-app -n production --all-containers
```

### Scale Services

```bash
# Manual scaling
kubectl scale deployment backend --replicas=5 -n production
kubectl scale deployment frontend --replicas=5 -n production

# Check HPA status
kubectl get hpa -n production
```

### Update Application

```bash
# Build new images with new tag
docker build -t your-dockerhub-username/crud-backend:v1.0.1 ./backend
docker push your-dockerhub-username/crud-backend:v1.0.1

# Update Helm release
helm upgrade crud-app ./helm/crud-app \
  -f ./helm/crud-app/values-production.yaml \
  --set backend.image.tag=v1.0.1 \
  --namespace production

# Rollback if needed
helm rollback crud-app -n production
```

### Backup MongoDB Data

```bash
# Create backup
kubectl exec -it mongodb-0 -n production -- mongodump --out=/tmp/backup

# Copy backup to local
kubectl cp production/mongodb-0:/tmp/backup ./mongodb-backup

# Restore backup
kubectl cp ./mongodb-backup production/mongodb-0:/tmp/restore
kubectl exec -it mongodb-0 -n production -- mongorestore /tmp/restore
```

## Troubleshooting

### Pods CrashLooping

```bash
# Check pod status
kubectl describe pod <pod-name> -n production

# Check logs
kubectl logs <pod-name> -n production --previous
```

### Database Connection Issues

```bash
# Check MongoDB pod
kubectl get pods -l app.kubernetes.io/name=mongodb -n production

# Test connection from backend
kubectl exec -it deployment/backend -n production -- sh
# Inside the pod:
curl -v mongodb-service:27017
```

### SSL Certificate Issues

```bash
# Check certificate
kubectl describe certificate narifighter-tls -n production

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager

# Force certificate renewal
kubectl delete secret narifighter-tls -n production
kubectl delete certificate narifighter-tls -n production
# Recreate ingress to trigger new certificate
kubectl delete ingress crud-app-ingress -n production
helm upgrade crud-app ./helm/crud-app -f ./helm/crud-app/values-production.yaml -n production
```

### Ingress Not Working

```bash
# Check ingress controller
kubectl get pods -n ingress-nginx

# Check ingress resource
kubectl describe ingress crud-app-ingress -n production

# Check nginx logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
```

## Cleanup

```bash
# Uninstall application
helm uninstall crud-app -n production

# Delete namespace
kubectl delete namespace production

# Delete persistent volumes
kubectl delete pvc -l app.kubernetes.io/instance=crud-app
```

## Production Best Practices

1. **Secrets Management**: Use Kubernetes secrets or external secret managers
2. **Backup Strategy**: Implement automated MongoDB backups
3. **Monitoring**: Set up Prometheus + Grafana
4. **Logging**: Configure centralized logging (ELK/Loki)
5. **Resource Limits**: Set appropriate CPU/memory limits
6. **Health Checks**: Ensure all probes are properly configured
7. **High Availability**: Run multiple replicas across nodes
8. **Security**: Implement network policies and RBAC
9. **Updates**: Use rolling updates with zero downtime
10. **Cost Optimization**: Monitor resource usage and optimize

## Support

For issues or questions:
- Check logs: `kubectl logs -f <pod-name> -n production`
- Describe resources: `kubectl describe <resource> <name> -n production`
- Check events: `kubectl get events -n production --sort-by='.lastTimestamp'`
