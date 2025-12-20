# Helm Charts Deployment Guide for K3s

## 📋 Overview

This repository contains 4 production-ready Helm charts for deploying a full-stack application on K3s:

1. **MongoDB** - StatefulSet with persistent storage
2. **Backend** - Node.js API Deployment
3. **Frontend** - React/Nginx Deployment  
4. **Caddy** - Reverse Proxy & Ingress Deployment

## 🏗️ Architecture Decisions

### Why These Resource Types?

#### 1. MongoDB → **StatefulSet** ✅
**Reason:** Databases require:
- **Stable network identity** - Each pod needs a consistent hostname
- **Persistent storage** - Data must survive pod restarts
- **Ordered deployment** - Pods start/stop in predictable order
- **Stable storage claims** - Each pod gets its own PVC

**Why NOT Deployment?** Deployments are stateless and pods can be replaced randomly, losing data.

**Why NOT DaemonSet?** DaemonSets run one pod per node - not suitable for databases that need specific replicas.

#### 2. Backend → **Deployment** ✅
**Reason:** APIs are stateless:
- Can scale horizontally without data loss
- Pods are interchangeable
- Rolling updates work seamlessly
- No persistent storage needed

#### 3. Frontend → **Deployment** ✅
**Reason:** Static web content:
- Completely stateless
- Easy to replicate
- Fast scaling
- No data persistence required

#### 4. Caddy → **Deployment** ✅
**Reason:** For single VPS setup:
- 2-3 replicas provide high availability
- Easier to manage than DaemonSet
- Works well with K3s ServiceLB (LoadBalancer)
- Certificates stored in PVC (shared or per-pod)

**Alternative:** Could use **DaemonSet** if you want Caddy on every node for direct traffic handling.

## 🔐 Secrets Management

All secrets are stored in **Kubernetes Secrets** (no Vault required):

- MongoDB credentials
- JWT secrets
- Database connection strings
- SSL certificates (Caddy auto-generates)

## 📦 Installation Order

### 1. Deploy MongoDB First
```bash
cd helm-charts/mongodb
helm install mongodb . --namespace production --create-namespace
```

**Verify:**
```bash
kubectl get statefulset mongodb -n production
kubectl get pvc -n production
kubectl get svc mongodb -n production
```

**Test Connection:**
```bash
kubectl run -it --rm debug --image=mongo:7 --restart=Never -n production -- \
  mongosh mongodb://maitrova:Saigollapalli%40122@mongodb:27017/appdb?authSource=admin
```

### 2. Deploy Backend
```bash
cd helm-charts/backend
helm install backend . --namespace production
```

**Verify:**
```bash
kubectl get deployment backend -n production
kubectl get pods -l app.kubernetes.io/name=backend -n production
kubectl logs -l app.kubernetes.io/name=backend -n production
```

**Test API:**
```bash
kubectl port-forward svc/backend 5000:5000 -n production
curl http://localhost:5000/api/health
```

### 3. Deploy Frontend
```bash
cd helm-charts/frontend
helm install frontend . --namespace production
```

**Verify:**
```bash
kubectl get deployment frontend -n production
kubectl get pods -l app.kubernetes.io/name=frontend -n production
```

### 4. Deploy Caddy (Ingress)
```bash
cd helm-charts/caddy
helm install caddy . --namespace production
```

**Verify:**
```bash
kubectl get deployment caddy -n production
kubectl get svc caddy -n production
```

**Get LoadBalancer IP:**
```bash
kubectl get svc caddy -n production
# Look for EXTERNAL-IP
```

## 🔧 Configuration

### MongoDB Values (`mongodb/values.yaml`)
```yaml
persistence:
  enabled: true
  hostPath: /home/sai/mongo_data  # Your existing path
  size: 20Gi

auth:
  rootUsername: maitrova
  # Password stored in secret
```

### Backend Values (`backend/values.yaml`)
```yaml
secrets:
  mongooseUrl: "mongodb://maitrova:Saigollapalli%40122@mongodb:27017/appdb?authSource=admin"
  jwtSecret: "maitrova"  # CHANGE THIS!

autoscaling:
  minReplicas: 2
  maxReplicas: 5
```

### Caddy Values (`caddy/values.yaml`)
```yaml
service:
  type: LoadBalancer  # K3s ServiceLB

caddyfile: |
  narifighter.online {
    @api path /api/*
    handle @api {
      reverse_proxy backend:5000
    }
    handle {
      reverse_proxy frontend:80
    }
  }
```

## 🚀 Production Checklist

### Before Deployment:

1. **Update Secrets:**
```bash
# Edit backend/templates/secret.yaml
kubectl create secret generic backend-secret \
  --from-literal=jwt-secret='your-strong-secret-here' \
  --from-literal=mongoose-password='Saigollapalli@122' \
  -n production --dry-run=client -o yaml | kubectl apply -f -
```

2. **Ensure MongoDB Storage:**
```bash
# Create directory on host if doesn't exist
sudo mkdir -p /home/sai/mongo_data
sudo chown -R 999:999 /home/sai/mongo_data
```

3. **Configure DNS:**
Point `narifighter.online` to your VPS IP address.

4. **Test K3s:**
```bash
kubectl get nodes
kubectl get sc  # Should see 'local-path' StorageClass
```

## 📊 Monitoring & Health

### Check All Services:
```bash
kubectl get all -n production
```

### Check Logs:
```bash
# MongoDB
kubectl logs -l app.kubernetes.io/name=mongodb -n production

# Backend
kubectl logs -l app.kubernetes.io/name=backend -n production --tail=100 -f

# Frontend
kubectl logs -l app.kubernetes.io/name=frontend -n production

# Caddy
kubectl logs -l app.kubernetes.io/name=caddy -n production --tail=100 -f
```

### Check Health Probes:
```bash
kubectl describe pod <pod-name> -n production
```

## 🔄 Upgrades

### Update an Application:
```bash
# Update image tag in values.yaml, then:
helm upgrade backend ./helm-charts/backend -n production

# Or inline:
helm upgrade backend ./helm-charts/backend \
  --set image.tag=v2.0.0 \
  -n production
```

### Rollback:
```bash
helm rollback backend 1 -n production
```

## 🧹 Cleanup

### Uninstall All:
```bash
helm uninstall caddy -n production
helm uninstall frontend -n production
helm uninstall backend -n production
helm uninstall mongodb -n production

# Delete namespace
kubectl delete namespace production
```

### Keep Data:
MongoDB PV is set to `Retain` policy, so data persists even after uninstall.

## 🐛 Troubleshooting

### MongoDB Won't Start:
```bash
# Check PVC status
kubectl get pvc -n production

# Check logs
kubectl logs mongodb-0 -n production

# Check permissions
ls -la /home/sai/mongo_data
```

### Backend Can't Connect to MongoDB:
```bash
# Test DNS resolution
kubectl run -it --rm debug --image=busybox -n production -- nslookup mongodb

# Check secret
kubectl get secret backend-secret -n production -o yaml
```

### Caddy SSL Issues:
```bash
# Check Caddy logs
kubectl logs -l app.kubernetes.io/name=caddy -n production

# Verify DNS points to LoadBalancer IP
nslookup narifighter.online
```

### LoadBalancer Pending:
K3s uses ServiceLB (Klipper). If stuck in Pending:
```bash
# Check traefik/servicelb pods
kubectl get pods -n kube-system | grep -E 'svclb|traefik'

# Alternative: Use NodePort instead
# Edit caddy/values.yaml: service.type: NodePort
```

## 📈 Scaling

### Manual Scaling:
```bash
kubectl scale deployment backend --replicas=5 -n production
```

### Autoscaling (HPA):
Already configured! HPA will scale based on CPU/Memory:
```bash
kubectl get hpa -n production
```

## 🔒 Security Best Practices

1. **Change Default Secrets** - Update JWT secret and MongoDB password
2. **Use Strong Passwords** - For MongoDB authentication
3. **Enable Network Policies** - Restrict pod-to-pod communication
4. **Limit Resource Usage** - Prevent resource exhaustion
5. **Regular Backups** - MongoDB data at `/home/sai/mongo_data`

## 📚 Additional Resources

- [K3s Documentation](https://docs.k3s.io/)
- [Helm Documentation](https://helm.sh/docs/)
- [Caddy Documentation](https://caddyserver.com/docs/)
- [MongoDB StatefulSet Best Practices](https://kubernetes.io/docs/tutorials/stateful-application/basic-stateful-set/)

## 🤝 Support

For issues or questions, check:
1. Pod logs: `kubectl logs <pod-name> -n production`
2. Pod events: `kubectl describe pod <pod-name> -n production`
3. Service endpoints: `kubectl get endpoints -n production`
