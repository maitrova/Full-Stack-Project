# Quick Reference: Helm Charts Structure

## 📁 Directory Structure
```
helm-charts/
├── README.md                    # Main deployment guide
├── RESOURCE-TYPES.md            # Detailed comparison & decisions
├── deploy.sh                    # Automated deployment script
│
├── mongodb/                     # StatefulSet
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── _helpers.tpl
│       ├── statefulset.yaml     # Main resource
│       ├── service.yaml         # Headless + Regular service
│       ├── secret.yaml          # K8s secret for credentials
│       └── pv.yaml              # PersistentVolume (hostPath)
│
├── backend/                     # Deployment
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── _helpers.tpl
│       ├── deployment.yaml      # Main resource
│       ├── service.yaml         # ClusterIP service
│       ├── secret.yaml          # K8s secret (JWT, DB creds)
│       ├── hpa.yaml             # HorizontalPodAutoscaler
│       └── pdb.yaml             # PodDisruptionBudget
│
├── frontend/                    # Deployment
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── _helpers.tpl
│       ├── deployment.yaml      # Main resource
│       ├── service.yaml         # ClusterIP service
│       ├── hpa.yaml             # HorizontalPodAutoscaler
│       └── pdb.yaml             # PodDisruptionBudget
│
└── caddy/                       # Deployment (Ingress)
    ├── Chart.yaml
    ├── values.yaml
    └── templates/
        ├── _helpers.tpl
        ├── deployment.yaml      # Main resource
        ├── service.yaml         # LoadBalancer service
        ├── configmap.yaml       # Caddyfile configuration
        ├── pvc.yaml             # PersistentVolumeClaim (certs)
        └── pdb.yaml             # PodDisruptionBudget
```

## 🎯 Quick Decision Matrix

### When to use what?

| Requirement | Use This |
|-------------|----------|
| Database with persistent data | **StatefulSet** |
| Stateless API/microservice | **Deployment** |
| Web frontend (React/Vue) | **Deployment** |
| Ingress/Reverse Proxy (single VPS) | **Deployment** |
| Monitoring agent on every node | **DaemonSet** |
| Logging collector on every node | **DaemonSet** |
| Network plugin on every node | **DaemonSet** |

## 🔧 Key Differences in Your Charts

### MongoDB (StatefulSet)
```yaml
# Why StatefulSet:
- Stable pod names: mongodb-0, mongodb-1
- Individual PVCs per pod
- Ordered scaling (0→1→2)
- Headless service for direct pod access
- Perfect for database clustering

# Files:
- statefulset.yaml (not deployment.yaml)
- service.yaml (headless + regular)
- pv.yaml (hostPath for single VPS)
```

### Backend & Frontend (Deployment)
```yaml
# Why Deployment:
- Stateless applications
- Random pod names
- Parallel scaling
- Rolling updates
- No persistent storage needed

# Files:
- deployment.yaml
- service.yaml (ClusterIP)
- hpa.yaml (autoscaling)
- pdb.yaml (high availability)
```

### Caddy (Deployment, not DaemonSet)
```yaml
# Why Deployment (not DaemonSet):
- Single VPS setup
- 2-3 replicas sufficient
- LoadBalancer service works better
- Easier management

# Why NOT DaemonSet:
- Single node = only 1 replica
- No HA with 1 pod
- Overkill for this setup

# Files:
- deployment.yaml
- service.yaml (LoadBalancer)
- configmap.yaml (Caddyfile)
- pvc.yaml (for SSL certs)
```

## 📊 Resource Comparison Table

| Feature | MongoDB | Backend | Frontend | Caddy |
|---------|---------|---------|----------|-------|
| **Resource Type** | StatefulSet | Deployment | Deployment | Deployment |
| **Replicas** | 1 (scalable) | 2-5 | 2-5 | 2 |
| **Service Type** | ClusterIP | ClusterIP | ClusterIP | LoadBalancer |
| **Storage** | PV + PVC | None | None | PVC (certs) |
| **Autoscaling** | Manual | HPA ✓ | HPA ✓ | Manual |
| **PDB** | No | Yes ✓ | Yes ✓ | Yes ✓ |
| **Secrets** | K8s Secret | K8s Secret | None | None |
| **ConfigMap** | None | None | None | Caddyfile |

## 🚀 Deployment Order

```bash
1. MongoDB    (StatefulSet) → Database must be ready first
   ↓
2. Backend    (Deployment)  → Needs MongoDB connection
   ↓
3. Frontend   (Deployment)  → Calls Backend API
   ↓
4. Caddy      (Deployment)  → Routes traffic to Frontend/Backend
```

## 🔐 Secrets Strategy

### MongoDB Secrets
```yaml
# mongodb/templates/secret.yaml
- mongodb-root-password
- mongodb-connection-string
```

### Backend Secrets
```yaml
# backend/templates/secret.yaml
- jwt-secret
- mongoose-password
- mongoose-url (references mongodb service)
```

### No Vault Required!
All secrets stored in Kubernetes Secrets:
```bash
kubectl get secrets -n production
kubectl describe secret mongodb-secret -n production
```

## 📝 Customization Guide

### Change MongoDB Storage Path
```yaml
# mongodb/values.yaml
persistence:
  hostPath: /your/custom/path  # Change this
```

### Change Backend Replicas
```yaml
# backend/values.yaml
autoscaling:
  minReplicas: 3    # Change this
  maxReplicas: 10   # Change this
```

### Change Caddy Domain
```yaml
# caddy/values.yaml
caddyfile: |
  your-domain.com {  # Change this
    # ... rest of config
  }
```

### Switch to NodePort (instead of LoadBalancer)
```yaml
# caddy/values.yaml
service:
  type: NodePort  # Change from LoadBalancer
  ports:
    http:
      nodePort: 30080  # Uncomment
    https:
      nodePort: 30443  # Uncomment
```

## 🔍 Validation Commands

### Check All Resources
```bash
kubectl get statefulsets -n production  # MongoDB
kubectl get deployments -n production   # Backend, Frontend, Caddy
kubectl get services -n production      # All services
kubectl get pvc -n production           # Persistent volumes
kubectl get secrets -n production       # All secrets
kubectl get hpa -n production           # Autoscalers
kubectl get pdb -n production           # Pod disruption budgets
```

### Check Health
```bash
# MongoDB
kubectl exec mongodb-0 -n production -- mongosh --eval "db.adminCommand('ping')"

# Backend
kubectl exec -it deployment/backend -n production -- curl localhost:5000/api/health

# Frontend
kubectl exec -it deployment/frontend -n production -- curl localhost:80

# Caddy
kubectl exec -it deployment/caddy -n production -- curl localhost:80
```

## 📚 Files Purpose

| File | Purpose | Required? |
|------|---------|-----------|
| `Chart.yaml` | Chart metadata | ✅ Yes |
| `values.yaml` | Default configuration | ✅ Yes |
| `_helpers.tpl` | Template functions | ✅ Yes |
| `deployment.yaml` | Deployment spec | ✅ (for Deployments) |
| `statefulset.yaml` | StatefulSet spec | ✅ (for MongoDB) |
| `service.yaml` | Service definition | ✅ Yes |
| `secret.yaml` | K8s secrets | ⚠️ Optional (can create manually) |
| `configmap.yaml` | Configuration | ⚠️ (only for Caddy) |
| `hpa.yaml` | Autoscaling | ⚠️ Optional |
| `pdb.yaml` | HA protection | ⚠️ Optional |
| `pv.yaml` | Persistent Volume | ⚠️ (only for MongoDB hostPath) |
| `pvc.yaml` | PV Claim | ⚠️ (Caddy & MongoDB) |

## 🎓 Learning Resources

- **StatefulSets**: https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/
- **Deployments**: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
- **DaemonSets**: https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/
- **K3s**: https://docs.k3s.io/
- **Helm Charts**: https://helm.sh/docs/chart_template_guide/

## ✅ Pre-Deployment Checklist

- [ ] K3s cluster is running
- [ ] `kubectl` configured and working
- [ ] `helm` installed
- [ ] MongoDB data directory exists: `/home/sai/mongo_data`
- [ ] DNS configured for your domain
- [ ] Secrets reviewed and updated
- [ ] Resource limits adjusted for your VPS

## 🎉 Quick Deploy

```bash
cd /Users/NYannam/devops-repos/Full-Stack-Project/helm-charts
./deploy.sh
```

Done! 🚀
