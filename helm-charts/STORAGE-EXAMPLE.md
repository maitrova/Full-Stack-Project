# MongoDB Storage Example - Real Data Flow

## 🎯 Complete Example: From API Call to Disk Storage

### Scenario: Creating a Product Document

```javascript
// 1. Frontend sends request
fetch('http://maitrova.in/api/products', {
  method: 'POST',
  body: JSON.stringify({
    name: "Cool T-Shirt",
    price: 29.99,
    category: "clothing"
  })
})
```

### Step-by-Step Storage Flow

#### Step 1: Request hits Caddy
```
User Browser
    ↓
    http://maitrova.in/api/products
    ↓
Caddy Pod (caddy-abc123)
    └─ Reverse proxy to backend:5000
```

#### Step 2: Backend processes request
```javascript
// Backend (server.js in Pod: backend-xyz789)
const mongoose = require('mongoose');

// Connection string points to MongoDB service
// mongodb://maitrova:password@mongodb:27017/appdb

app.post('/api/products', async (req, res) => {
  const product = new Product({
    name: "Cool T-Shirt",
    price: 29.99,
    category: "clothing"
  });
  
  await product.save();  // ← This triggers MongoDB write
  res.json(product);
});
```

#### Step 3: Backend talks to MongoDB Service
```
Backend Pod (backend-xyz789)
    ↓
    DNS lookup: mongodb:27017
    ↓
MongoDB Service (ClusterIP)
    ↓
    Routes to ──▶ mongodb-0 pod
```

#### Step 4: MongoDB writes to /data/db
```
Inside Pod: mongodb-0
┌─────────────────────────────────────────┐
│ MongoDB Process (mongod)                │
│   ↓                                     │
│ Write document to collection            │
│   ↓                                     │
│ /data/db/collection-2--123.wt          │
│     ↑                                   │
│     └── This is mounted from PVC        │
└─────────────────────────────────────────┘
```

#### Step 5: PVC → PV → Host mapping
```yaml
# The mount chain:
Pod mongodb-0
  └─ volumeMount: /data/db
       └─ volume: data (PVC)
            └─ PVC: data-mongodb-0
                 └─ bound to PV: mongodb-pv
                      └─ hostPath: /home/sai/mongo_data

# Result: Writing to /data/db in container
#         = Writing to /home/sai/mongo_data on host
```

#### Step 6: Data on disk
```bash
# On your VPS host machine:
$ sudo ls -lh /home/sai/mongo_data/

total 128M
-rw-------  1 999 999  16K Dec  3 10:30 WiredTiger
-rw-------  1 999 999  21  Dec  3 10:30 WiredTiger.lock
-rw-------  1 999 999 1.4K Dec  3 10:30 WiredTiger.turtle
-rw-------  1 999 999 109K Dec  3 10:35 WiredTiger.wt     ← Metadata
-rw-------  1 999 999  20M Dec  3 10:35 collection-0-123.wt  ← YOUR DATA IS HERE!
-rw-------  1 999 999  16M Dec  3 10:35 index-1-123.wt   ← Indexes
-rw-------  1 999 999  32K Dec  3 10:30 _mdb_catalog.wt
-rw-------  1 999 999  64K Dec  3 10:30 sizeStorer.wt
drwx------  2 999 999 4.0K Dec  3 10:30 journal/         ← Transaction logs
```

## 🔬 Let's Prove It!

### Test 1: Write data and verify on host

```bash
# 1. Insert document via MongoDB shell
kubectl exec -it mongodb-0 -n production -- mongosh \
  -u maitrova -p 'Saigollapalli@122' --authenticationDatabase admin

use appdb
db.products.insertOne({
  name: "Cool T-Shirt",
  price: 29.99,
  category: "clothing",
  createdAt: new Date()
})

# Exit mongosh
exit
```

```bash
# 2. Check file modification time on host
sudo ls -lh /home/sai/mongo_data/collection-*.wt

# You'll see the file was just modified (timestamp changes)
-rw------- 1 999 999 20M Dec  3 10:37 collection-0-123.wt  ← Just updated!
```

```bash
# 3. Check size increased
sudo du -sh /home/sai/mongo_data/
# Before: 128M
# After:  129M  ← Size increased because we added data!
```

### Test 2: Pod restart preserves data

```bash
# 1. Delete the pod
kubectl delete pod mongodb-0 -n production

# 2. StatefulSet automatically recreates it
# New pod: mongodb-0 (same name!)

# 3. Data is still there!
kubectl exec -it mongodb-0 -n production -- mongosh \
  -u maitrova -p 'Saigollapalli@122' --authenticationDatabase admin

use appdb
db.products.find()

# Result: Your "Cool T-Shirt" is still there! ✅
```

**Why?** The new `mongodb-0` pod mounts the **same PVC** (`data-mongodb-0`) which points to the **same host directory** (`/home/sai/mongo_data`).

## 📊 Data Persistence Scenarios

### Scenario 1: Pod Crashes
```
mongodb-0 (crashed) ❌
    ↓
StatefulSet recreates pod
    ↓
mongodb-0 (new) ✅
    └─ Mounts same PVC: data-mongodb-0
         └─ Points to same hostPath: /home/sai/mongo_data
              └─ All your data is intact! ✅
```

### Scenario 2: Pod Deleted Manually
```
$ kubectl delete pod mongodb-0 -n production

Pod deleted ❌
    ↓
PVC: data-mongodb-0 still exists ✅
    └─ PV: mongodb-pv still exists ✅
         └─ Host data: /home/sai/mongo_data intact ✅
              ↓
StatefulSet creates new mongodb-0 ✅
    └─ Mounts same PVC
         └─ Data restored immediately! ✅
```

### Scenario 3: Helm Uninstall
```
$ helm uninstall mongodb -n production

StatefulSet deleted ❌
Pod mongodb-0 deleted ❌
PVC: data-mongodb-0 → Depends on reclaim policy
    ├─ If ReclaimPolicy: Retain → PVC kept ✅
    └─ If ReclaimPolicy: Delete → PVC deleted ❌

BUT: Host directory /home/sai/mongo_data → ALWAYS KEPT ✅
(Manual deletion required if you want to remove)
```

### Scenario 4: VPS Reboot
```
VPS reboots 🔄
    ↓
K3s service restarts ✅
    ↓
All pods restart (including mongodb-0) ✅
    ↓
PVC remounts /home/sai/mongo_data ✅
    ↓
Data intact! ✅
```

## 🔍 How to Check Where Data Lives

### Inside the Container:
```bash
kubectl exec mongodb-0 -n production -- df -h /data/db
# Shows: Mounted volume size and usage
```

### On the Host:
```bash
# Find where K3s mounts volumes
sudo ls -la /var/lib/rancher/k3s/storage/

# Or directly check your hostPath
sudo ls -la /home/sai/mongo_data/
```

### Check PVC Details:
```bash
kubectl describe pvc data-mongodb-0 -n production

# Output shows:
Name:          data-mongodb-0
Namespace:     production
StorageClass:  local-path
Status:        Bound
Volume:        mongodb-pv
Capacity:      20Gi
Access Modes:  RWO
Used By:       mongodb-0  ← Pod using this PVC
```

## 🎓 Key Concepts Explained

### 1. hostPath Volume Type
```yaml
# Your PV uses hostPath:
spec:
  hostPath:
    path: /home/sai/mongo_data
    type: DirectoryOrCreate
```

**What this means:**
- MongoDB writes to `/data/db` inside container
- Kubernetes maps it to `/home/sai/mongo_data` on host
- **It's the same directory!** Just different paths
- Like a symbolic link but at the Kubernetes level

### 2. Why StatefulSet Creates Individual PVCs
```yaml
# If you scale to 3 replicas:
mongodb-0 → data-mongodb-0 → /home/sai/mongo_data/replica-0
mongodb-1 → data-mongodb-1 → /home/sai/mongo_data/replica-1
mongodb-2 → data-mongodb-2 → /home/sai/mongo_data/replica-2
```

Each pod gets its **own storage** so they don't conflict.

### 3. Data Flow Summary
```
Your Application Data
    ↓
Backend API call to MongoDB
    ↓
MongoDB Pod (mongodb-0) writes to /data/db
    ↓
Kubernetes Volume Mount (PVC: data-mongodb-0)
    ↓
Persistent Volume (PV: hostPath)
    ↓
Physical Disk: /home/sai/mongo_data/
    ↓
Actual .wt files (WiredTiger format)
```

## 🛠️ Practical Commands

### View your actual data size:
```bash
# On host
sudo du -sh /home/sai/mongo_data/

# Inside container (same data)
kubectl exec mongodb-0 -n production -- du -sh /data/db
```

### Backup your data:
```bash
# Since it's just a directory, you can backup directly
sudo tar -czf mongodb-backup-$(date +%F).tar.gz /home/sai/mongo_data/

# Or use mongodump inside container
kubectl exec mongodb-0 -n production -- mongodump --out=/data/db/backup
```

### Restore from backup:
```bash
# Stop MongoDB
kubectl scale statefulset mongodb --replicas=0 -n production

# Restore files on host
sudo rm -rf /home/sai/mongo_data/*
sudo tar -xzf mongodb-backup-2025-12-03.tar.gz -C /

# Start MongoDB
kubectl scale statefulset mongodb --replicas=1 -n production
```

## 🎯 Bottom Line

When MongoDB receives data:

1. **MongoDB thinks** it's writing to `/data/db` inside the container
2. **Kubernetes intercepts** this and maps it to the PVC
3. **The PVC is bound** to a PV with hostPath
4. **The actual data** ends up in `/home/sai/mongo_data/` on your VPS
5. **The files are identical** - writing to one = writing to the other

**It's transparent to MongoDB!** MongoDB has no idea its data is on the host filesystem. Kubernetes handles all the magic! ✨
