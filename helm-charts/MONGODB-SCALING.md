# MongoDB Scaling Guide - Single vs Replica Set

## 🎯 Your Question: "If I have 2 mongo pods, is ReadWriteOnce right?"

**Short Answer:** ReadWriteOnce is ALWAYS right for MongoDB StatefulSet, even with multiple pods!

---

## 📊 Understanding ReadWriteOnce with StatefulSet

### How It Actually Works:

```
MongoDB with replicaCount: 3

Pod 1: mongodb-0
  └─ Gets its OWN PVC: data-mongodb-0 (RWO) ✅
      └─ Binds to: mongodb-pv-0
          └─ /home/sai/mongo_data/replica-0/

Pod 2: mongodb-1
  └─ Gets its OWN PVC: data-mongodb-1 (RWO) ✅
      └─ Binds to: mongodb-pv-1
          └─ /home/sai/mongo_data/replica-1/

Pod 3: mongodb-2
  └─ Gets its OWN PVC: data-mongodb-2 (RWO) ✅
      └─ Binds to: mongodb-pv-2
          └─ /home/sai/mongo_data/replica-2/
```

**Key Point:** Each pod gets its OWN PVC, so `ReadWriteOnce` is perfect!

---

## ✅ ReadWriteOnce is CORRECT Because:

1. **Each pod gets individual PVC** (data-mongodb-0, data-mongodb-1, etc.)
2. **Each PVC is ReadWriteOnce** (only that one pod uses it)
3. **MongoDB replicates data** between pods via MongoDB's internal replication
4. **NOT shared storage** - they sync through MongoDB protocol

---

## 🔄 Access Modes Explained

| Mode | Meaning | MongoDB Use? |
|------|---------|--------------|
| **ReadWriteOnce (RWO)** | One pod can mount for read/write | ✅ **CORRECT** - Each pod gets own PVC |
| **ReadOnlyMany (ROX)** | Many pods can mount read-only | ❌ Wrong - MongoDB needs to write |
| **ReadWriteMany (RWX)** | Many pods share same storage | ❌ Wrong - MongoDB doesn't share storage |

---

## 🎯 Single VPS Setup (Your Current Scenario)

### Current Configuration - PERFECT ✅
```yaml
# values.yaml
replicaCount: 1
persistence:
  accessMode: ReadWriteOnce  # ← Correct!
  hostPath: /home/sai/mongo_data
```

**Result:**
- 1 MongoDB pod
- 1 PVC (data-mongodb-0)
- 1 PV (mongodb-pv)
- 1 directory on host

**✅ This is CORRECT for single VPS!**

---

## 📈 If You Scale to 2-3 Pods (High Availability)

### Configuration Changes Needed:
```yaml
# values.yaml
replicaCount: 3  # ← Change this
persistence:
  accessMode: ReadWriteOnce  # ← KEEP THIS SAME!
  # But need multiple PVs...
```

### Challenge on Single VPS:
```
Problem: You only have 1 physical machine!

Option 1: Multiple directories (hostPath)
/home/sai/mongo_data/replica-0/  → PV-0 → mongodb-0
/home/sai/mongo_data/replica-1/  → PV-1 → mongodb-1
/home/sai/mongo_data/replica-2/  → PV-2 → mongodb-2

Option 2: Use K3s local-path provisioner
Let K3s create PVs automatically in:
/var/lib/rancher/k3s/storage/pvc-xxx/
```

---

## 🛠️ If You Want MongoDB Replica Set (2-3 Pods)

### Step 1: Update values.yaml
```yaml
replicaCount: 3  # Change from 1 to 3

# Remove manual PV creation, use dynamic provisioning
persistence:
  enabled: true
  storageClass: "local-path"  # K3s will create PVs automatically
  accessMode: ReadWriteOnce   # Keep this!
  size: 20Gi
  # Remove hostPath - let K3s manage it
```

### Step 2: Remove manual PV template
```bash
# Delete or disable pv.yaml since K3s will create them
# Comment out the {{- if }} condition or delete the file
```

### Step 3: Add MongoDB replica set configuration
```yaml
# values.yaml - Add these:
mongodbReplicaSet:
  enabled: true
  name: "rs0"
  useHostnames: true

# Command to initialize replica set
mongodbExtraFlags:
  - "--bind_ip_all"
  - "--replSet=rs0"
```

### Result:
```
K3s automatically creates:
- PV: pvc-abc123 → /var/lib/rancher/k3s/storage/pvc-abc123/
- PVC: data-mongodb-0 (RWO) → Bound to PV above
- Pod: mongodb-0 → Uses data-mongodb-0

- PV: pvc-def456 → /var/lib/rancher/k3s/storage/pvc-def456/
- PVC: data-mongodb-1 (RWO) → Bound to PV above
- Pod: mongodb-1 → Uses data-mongodb-1

- PV: pvc-ghi789 → /var/lib/rancher/k3s/storage/pvc-ghi789/
- PVC: data-mongodb-2 (RWO) → Bound to PV above
- Pod: mongodb-2 → Uses data-mongodb-2

Each still uses ReadWriteOnce! ✅
```

---

## ⚠️ Important Considerations

### Single VPS Limitations:
```
❌ All 3 MongoDB pods run on same physical machine
❌ If VPS fails, all replicas fail (no true HA)
❌ Competing for same CPU/RAM/Disk
❌ No node-level redundancy

✅ Good for: Learning, testing, data redundancy
❌ Bad for: True high availability
```

### When to Use Replica Set:
- ✅ Multi-node cluster (3+ nodes)
- ✅ Need data redundancy
- ✅ Want zero-downtime updates
- ✅ Production workloads

### When to Use Single Instance:
- ✅ Single VPS (like yours)
- ✅ Development/staging
- ✅ Cost-effective setup
- ✅ Simpler management

---

## 🎓 Summary

### Your Question: "Is ReadWriteOnce right for 2 mongo pods?"

**YES!** ✅ ReadWriteOnce is ALWAYS correct for MongoDB StatefulSet!

**Why?**
- Each pod gets its own PVC
- Each PVC is ReadWriteOnce (one pod per PVC)
- MongoDB handles data replication internally
- NOT shared storage between pods

### Current Setup (1 Pod):
```yaml
replicaCount: 1
accessMode: ReadWriteOnce  # ✅ CORRECT
```

### If Scaling to 2-3 Pods:
```yaml
replicaCount: 3
accessMode: ReadWriteOnce  # ✅ STILL CORRECT (don't change!)
```

**The access mode stays the same!** Each pod gets its own RWO PVC.

---

## 📝 Recommendation for Your Single VPS

**Keep it simple:**
```yaml
replicaCount: 1           # ✅ Keep as 1
accessMode: ReadWriteOnce # ✅ Keep as is
hostPath: /home/sai/mongo_data  # ✅ Keep as is
```

**Reasons:**
1. Single VPS = no real HA benefit from replica set
2. Uses less resources (CPU, RAM, disk)
3. Simpler to manage
4. Easier backups
5. Your current setup is production-ready for single VPS! ✅

---

## 🚀 If You Later Move to Multi-Node Cluster

Then you can scale:
```yaml
# For 3-node cluster:
replicaCount: 3
accessMode: ReadWriteOnce  # ← Still RWO!

# Add pod anti-affinity to spread across nodes:
podAntiAffinity:
  requiredDuringSchedulingIgnoredDuringExecution:
    - labelSelector:
        matchLabels:
          app.kubernetes.io/name: mongodb
      topologyKey: kubernetes.io/hostname
```

Each pod goes to different node = true HA! 🎉
