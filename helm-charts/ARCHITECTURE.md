# 📊 Visual Architecture & Decisions

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         K3s Cluster (Single VPS)                    │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  NAMESPACE: production                                      │   │
│  │                                                             │   │
│  │  ┌──────────────────────────────────────────────────────┐ │   │
│  │  │  CADDY (Deployment - 2 replicas)                     │ │   │
│  │  │  - LoadBalancer Service (80, 443)                    │ │   │
│  │  │  - SSL/TLS Termination                               │ │   │
│  │  │  - Reverse Proxy                                     │ │   │
│  │  └────────────┬─────────────────────────────────────────┘ │   │
│  │               │                                            │   │
│  │     ┌─────────┴──────────┐                                │   │
│  │     │                    │                                │   │
│  │  ┌──▼────────────┐  ┌───▼──────────────┐                 │   │
│  │  │  FRONTEND     │  │  BACKEND         │                 │   │
│  │  │  (Deployment) │  │  (Deployment)    │                 │   │
│  │  │  - 2-5 pods   │  │  - 2-5 pods      │                 │   │
│  │  │  - Port 80    │  │  - Port 5000     │                 │   │
│  │  │  - React/Vue  │  │  - Node.js API   │                 │   │
│  │  │  - Nginx      │  │  - Express       │                 │   │
│  │  └───────────────┘  └─────────┬────────┘                 │   │
│  │                               │                           │   │
│  │                    ┌──────────▼──────────┐                │   │
│  │                    │  MONGODB            │                │   │
│  │                    │  (StatefulSet)      │                │   │
│  │                    │  - 1 pod (mongodb-0)│                │   │
│  │                    │  - Port 27017       │                │   │
│  │                    │  - Persistent Vol   │                │   │
│  │                    └─────────────────────┘                │   │
│  │                              │                             │   │
│  └──────────────────────────────┼─────────────────────────────┘   │
│                                 │                                 │
│                    ┌────────────▼──────────────┐                  │
│                    │  Host Storage             │                  │
│                    │  /home/sai/mongo_data     │                  │
│                    └───────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘

INTERNET ──▶ narifighter.online ──▶ LoadBalancer IP ──▶ CADDY
```

## 🎯 Why Each Resource Type?

### MongoDB: StatefulSet ✅
```
┌─────────────────────────────────────────────────┐
│ StatefulSet: mongodb                            │
├─────────────────────────────────────────────────┤
│ Pod: mongodb-0                                  │
│   └─ PVC: data-mongodb-0 ──▶ /data/db          │
│      └─ PV: hostPath ──▶ /home/sai/mongo_data  │
│                                                 │
│ Pod: mongodb-1 (if scaled)                      │
│   └─ PVC: data-mongodb-1 ──▶ /data/db          │
│      └─ PV: hostPath-1                          │
│                                                 │
│ ✓ Stable names (mongodb-0, mongodb-1)          │
│ ✓ Individual storage per pod                   │
│ ✓ Ordered deployment (0 before 1)              │
│ ✓ DNS: mongodb-0.mongodb-headless.svc          │
└─────────────────────────────────────────────────┘

Why NOT Deployment?
┌─────────────────────────────────────────────────┐
│ ✗ Random pod names (mongodb-xyz123)             │
│ ✗ Shared storage or none                        │
│ ✗ No guaranteed order                           │
│ ✗ Data loss risk on pod replacement             │
└─────────────────────────────────────────────────┘
```

### Backend/Frontend: Deployment ✅
```
┌─────────────────────────────────────────────────┐
│ Deployment: backend                             │
├─────────────────────────────────────────────────┤
│ Pod: backend-abc123 ┐                           │
│ Pod: backend-def456 ├─ LoadBalanced            │
│ Pod: backend-ghi789 ┘   by Service              │
│                                                 │
│ ✓ Stateless (no data to persist)               │
│ ✓ Can scale horizontally                        │
│ ✓ Fast rolling updates                          │
│ ✓ Self-healing                                  │
│ ✓ Random names OK                               │
└─────────────────────────────────────────────────┘

Why NOT StatefulSet?
┌─────────────────────────────────────────────────┐
│ ✗ Unnecessary complexity                        │
│ ✗ Slower scaling (sequential)                   │
│ ✗ No benefit for stateless apps                 │
└─────────────────────────────────────────────────┘
```

### Caddy: Deployment (not DaemonSet) ✅
```
┌─────────────────────────────────────────────────┐
│ Deployment: caddy (Single VPS)                  │
├─────────────────────────────────────────────────┤
│ Pod: caddy-abc123 ┐                             │
│ Pod: caddy-def456 ┘─ LoadBalancer Service       │
│                                                 │
│ ✓ 2 replicas for HA                             │
│ ✓ Can scale based on traffic                    │
│ ✓ Easy to manage                                │
│ ✓ Works with LoadBalancer                       │
└─────────────────────────────────────────────────┘

Why NOT DaemonSet (for single VPS)?
┌─────────────────────────────────────────────────┐
│ ✗ Only 1 pod on single node = No HA             │
│ ✗ Can't control replica count                   │
│ ✗ Overkill for this setup                       │
└─────────────────────────────────────────────────┘

When to use DaemonSet for Caddy?
┌─────────────────────────────────────────────────┐
│ ✓ Multi-node cluster (3+ nodes)                 │
│ ✓ Want ingress on EVERY node                    │
│ ✓ Direct node traffic handling                  │
│ ✓ Example: 5 nodes = 5 caddy pods              │
└─────────────────────────────────────────────────┘
```

## 📊 Scaling Behavior Comparison

### StatefulSet Scaling (MongoDB)
```
Scale Up (1 → 3):
  0 ──▶ Ready ──▶ 1 ──▶ Ready ──▶ 2 ──▶ Ready
  (Sequential, ordered)

Scale Down (3 → 1):
  2 ──▶ Deleted ──▶ 1 ──▶ Deleted ──▶ 0
  (Reverse order)

Each pod gets its own PVC:
  mongodb-0 ──▶ data-mongodb-0 ──▶ PV-0
  mongodb-1 ──▶ data-mongodb-1 ──▶ PV-1
  mongodb-2 ──▶ data-mongodb-2 ──▶ PV-2
```

### Deployment Scaling (Backend/Frontend)
```
Scale Up (2 → 5):
  All 3 new pods start in parallel ▶▶▶
  (Fast, no waiting)

Scale Down (5 → 2):
  3 pods deleted simultaneously ◀◀◀
  (Fast)

All pods share resources:
  backend-abc ┐
  backend-def ├─ Same Service
  backend-ghi ┘   No individual storage
```

### DaemonSet "Scaling" (Monitoring Example)
```
Scales with nodes (automatic):
  
  1 node  → 1 pod
  3 nodes → 3 pods
  5 nodes → 5 pods

Cannot manually set replica count!
Each pod runs on a different node.
```

## 🔄 Update Behavior

### StatefulSet (MongoDB) - Ordered Updates
```
Rolling Update:
  1. Update mongodb-2 ──▶ Wait ──▶ Ready
  2. Update mongodb-1 ──▶ Wait ──▶ Ready
  3. Update mongodb-0 ──▶ Wait ──▶ Ready

(Reverse order, one at a time)
⏱️  Slower but safer for databases
```

### Deployment (Backend/Frontend) - Parallel Updates
```
Rolling Update (maxSurge=1, maxUnavailable=0):
  Old: [A] [A] [A]
       ↓
  New: [B] [A] [A]  ← Create 1 new (surge)
       ↓
       [B] [B] [A]  ← Delete 1 old
       ↓
       [B] [B] [B]  ← Continue until done

⏱️  Fast updates with zero downtime
```

## 🗄️ Storage Comparison

### StatefulSet Storage (MongoDB)
```
┌─────────────────────────────────────────┐
│ Pod: mongodb-0                          │
│   ├─ PVC: data-mongodb-0               │
│   │   ├─ Size: 20Gi                    │
│   │   └─ PV ──▶ /home/sai/mongo_data   │
│   └─ Mount: /data/db                   │
│                                         │
│ ✓ Survives pod restart                  │
│ ✓ Survives pod deletion                 │
│ ✓ Independent from pod lifecycle        │
└─────────────────────────────────────────┘
```

### Deployment Storage (Backend/Frontend)
```
┌─────────────────────────────────────────┐
│ Pod: backend-abc123                     │
│   └─ No persistent storage              │
│      (or shared emptyDir/PVC)           │
│                                         │
│ ✓ No storage needed for stateless apps │
│ ✓ Fresh start every time                │
│ ✓ No data to worry about                │
└─────────────────────────────────────────┘
```

## 🌐 Service & Networking

### MongoDB Services
```
1. Headless Service (for StatefulSet):
   mongodb-headless (ClusterIP: None)
   ├─ mongodb-0.mongodb-headless.svc:27017
   ├─ mongodb-1.mongodb-headless.svc:27017
   └─ Direct pod access for replication

2. Regular Service:
   mongodb (ClusterIP)
   └─ LoadBalanced access to all pods
```

### Backend/Frontend Services
```
Service: backend (ClusterIP)
  ├─ backend:5000
  └─ Round-robin to all pods
     ├─ backend-abc:5000
     ├─ backend-def:5000
     └─ backend-ghi:5000
```

### Caddy Service
```
Service: caddy (LoadBalancer)
  ├─ External IP: x.x.x.x
  ├─ Port 80 ──▶ caddy pods:80
  └─ Port 443 ──▶ caddy pods:443
```

## 📈 High Availability Setup

### Current Setup (Single VPS)
```
┌─────────────────────────────────────────┐
│ MongoDB:  1 replica (can scale to 3)   │
│ Backend:  2 replicas (HPA: 2-5)        │
│ Frontend: 2 replicas (HPA: 2-5)        │
│ Caddy:    2 replicas                    │
│                                         │
│ ✓ Basic HA for stateless services      │
│ ✗ Single point of failure: VPS itself  │
└─────────────────────────────────────────┘
```

### Production HA (3-Node Cluster)
```
┌─────────────────────────────────────────┐
│ MongoDB:  3 replicas (StatefulSet)      │
│   ├─ mongodb-0 on node-1                │
│   ├─ mongodb-1 on node-2                │
│   └─ mongodb-2 on node-3                │
│                                         │
│ Backend:  3-6 replicas (spread)         │
│ Frontend: 3-6 replicas (spread)         │
│ Caddy:    3 replicas or DaemonSet       │
│                                         │
│ ✓ Full HA with node failures            │
│ ✓ Database replication                  │
└─────────────────────────────────────────┘
```

## 🎓 Decision Tree

```
Need persistent storage?
    │
    ├─ YES ──▶ Is it a database/stateful app?
    │          │
    │          ├─ YES ──▶ StatefulSet ✅
    │          │          (MongoDB, PostgreSQL, etc.)
    │          │
    │          └─ NO ──▶ Deployment with PVC
    │                    (Shared storage OK)
    │
    └─ NO ──▶ Stateless application?
               │
               ├─ YES ──▶ Need on every node?
               │          │
               │          ├─ YES ──▶ DaemonSet
               │          │          (Monitoring, logging)
               │          │
               │          └─ NO ──▶ Deployment ✅
               │                    (Backend, Frontend)
               │
               └─ NO ──▶ Special case (Jobs, CronJobs)
```

## 💡 Pro Tips

### MongoDB Best Practices
```
✓ Use StatefulSet (always!)
✓ Set up PVC per pod
✓ Use headless service for replication
✓ Set proper resource limits
✓ Regular backups of /home/sai/mongo_data
✓ Consider 3 replicas for production
```

### Backend/Frontend Best Practices
```
✓ Use Deployment
✓ Enable HPA for auto-scaling
✓ Set PDB for high availability
✓ Use rolling updates
✓ Health checks (liveness/readiness)
✓ Resource limits to prevent OOM
```

### Caddy Best Practices
```
✓ Use Deployment for single VPS
✓ 2 replicas minimum for HA
✓ Store Caddyfile in ConfigMap
✓ PVC for SSL certificate storage
✓ LoadBalancer for public access
✓ Consider DaemonSet for multi-node
```

## 🚨 Common Mistakes to Avoid

```
❌ Using Deployment for MongoDB
   → Data loss, unstable pods

❌ Using StatefulSet for stateless apps
   → Slow scaling, unnecessary complexity

❌ Using DaemonSet on single VPS
   → Only 1 replica = no HA

❌ No PVC for Caddy
   → SSL certificates lost on restart

❌ No resource limits
   → OOM kills, node crashes

❌ No PDB
   → All pods can be evicted at once
```

## 📝 Summary

| Component | Type | Replicas | Why |
|-----------|------|----------|-----|
| MongoDB | StatefulSet | 1 → 3 | Persistent data, stable identity |
| Backend | Deployment | 2 → 5 | Stateless API, easy scaling |
| Frontend | Deployment | 2 → 5 | Static content, stateless |
| Caddy | Deployment | 2 | Ingress, single VPS setup |

Your setup is **PRODUCTION-READY** for a single VPS! 🎉
