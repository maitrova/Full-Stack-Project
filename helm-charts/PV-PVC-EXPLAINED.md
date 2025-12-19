# Understanding PV and PVC - Visual Example

## 🎬 Timeline: What Happens When You Deploy MongoDB

### Before Deployment
```
Your VPS Host:
/home/sai/mongo_data/  ← Empty directory exists
```

---

### Step 1: You Deploy MongoDB Helm Chart
```bash
$ helm install mongodb ./mongodb -n production
```

---

### Step 2: Kubernetes Creates PersistentVolume (PV)
```yaml
# File: mongodb/templates/pv.yaml creates this:

apiVersion: v1
kind: PersistentVolume
metadata:
  name: mongodb-pv                    # ← The "apartment building"
spec:
  capacity:
    storage: 20Gi                     # ← Size of the apartment
  accessModes:
    - ReadWriteOnce                   # ← Only one tenant at a time
  persistentVolumeReclaimPolicy: Retain
  storageClassName: local-path
  hostPath:
    path: /home/sai/mongo_data        # ← Physical location on your VPS
    type: DirectoryOrCreate
```

**What this means:**
- "I have 20GB of storage"
- "It's located at `/home/sai/mongo_data` on the host"
- "Only one pod can use it at a time"
- "Keep the data even if PVC is deleted"

---

### Step 3: StatefulSet Creates PersistentVolumeClaim (PVC)
```yaml
# mongodb/templates/statefulset.yaml includes:

volumeClaimTemplates:
  - metadata:
      name: data                      # ← This becomes "data-mongodb-0"
    spec:
      accessModes:
        - ReadWriteOnce
      storageClassName: local-path
      resources:
        requests:
          storage: 20Gi               # ← "I need 20GB"
```

**What happens:**
```
StatefulSet creates Pod: mongodb-0
    ↓
Automatically creates PVC: data-mongodb-0
    ↓
PVC says: "I need 20Gi with local-path storage class"
```

---

### Step 4: Kubernetes Binds PVC to PV
```
Kubernetes Matching Process:
┌─────────────────────────────────────────────────┐
│ Looking for PV that matches PVC requirements:   │
│                                                 │
│ PVC Needs:                  PV Has:             │
│ ✓ 20Gi                      ✓ 20Gi             │
│ ✓ ReadWriteOnce             ✓ ReadWriteOnce    │
│ ✓ local-path class          ✓ local-path class │
│                                                 │
│ MATCH! ✅                                       │
│                                                 │
│ PVC: data-mongodb-0  ←──[BOUND]──→  PV: mongodb-pv
└─────────────────────────────────────────────────┘
```

---

### Step 5: Pod Mounts the PVC
```yaml
# Inside mongodb-0 pod:

spec:
  containers:
    - name: mongodb
      volumeMounts:
        - name: data                  # ← References the PVC
          mountPath: /data/db         # ← Where MongoDB writes
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: data-mongodb-0     # ← The PVC we created
```

---

### Step 6: The Complete Chain
```
┌─────────────────────────────────────────────────────────────┐
│ 1. Pod: mongodb-0                                           │
│    "I want to write to /data/db"                            │
│                                                             │
│    Inside container:                                        │
│    /data/db/collection.wt  ← MongoDB writes here           │
│         ↓                                                   │
│         │ (mounted from PVC)                                │
│         ↓                                                   │
├─────────────────────────────────────────────────────────────┤
│ 2. PVC: data-mongodb-0                                      │
│    "I'm claiming storage from a PV"                         │
│                                                             │
│    Status: Bound                                            │
│    Bound to: mongodb-pv                                     │
│         ↓                                                   │
│         │ (bound to)                                        │
│         ↓                                                   │
├─────────────────────────────────────────────────────────────┤
│ 3. PV: mongodb-pv                                           │
│    "I provide the actual storage"                           │
│                                                             │
│    Type: hostPath                                           │
│    Path: /home/sai/mongo_data                               │
│         ↓                                                   │
│         │ (maps to)                                         │
│         ↓                                                   │
├─────────────────────────────────────────────────────────────┤
│ 4. Host Filesystem                                          │
│    /home/sai/mongo_data/collection.wt  ← File appears here!│
│                                                             │
│    This is your actual VPS disk!                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔬 Real Example: Writing Data

### Example 1: Create a Document

```javascript
// Your app creates a user
db.users.insertOne({
  name: "Alice",
  email: "alice@example.com"
})
```

**Data flow:**
```
1. MongoDB process in pod writes:
   /data/db/collection-0.wt

2. Kubernetes sees write to /data/db
   "Oh, this is mounted from PVC: data-mongodb-0"

3. PVC is bound to PV: mongodb-pv
   "Route this write to the PV"

4. PV has hostPath: /home/sai/mongo_data
   "Write to the host filesystem"

5. File appears on host:
   /home/sai/mongo_data/collection-0.wt

RESULT: Same file, just different paths!
```

### Example 2: Check the Files

**Inside container:**
```bash
$ kubectl exec mongodb-0 -n production -- ls -lh /data/db

-rw------- 1 999 999  20M Dec 3 10:00 collection-0.wt
-rw------- 1 999 999  16M Dec 3 10:00 index-1.wt
-rw------- 1 999 999  32K Dec 3 10:00 WiredTiger.wt
```

**On host (your VPS):**
```bash
$ sudo ls -lh /home/sai/mongo_data/

-rw------- 1 999 999  20M Dec 3 10:00 collection-0.wt  ← Same file!
-rw------- 1 999 999  16M Dec 3 10:00 index-1.wt       ← Same file!
-rw------- 1 999 999  32K Dec 3 10:00 WiredTiger.wt    ← Same file!
```

**They're the SAME files!** Just accessed through different paths.

---

## 🎯 Key Differences: PV vs PVC

| Aspect | PersistentVolume (PV) | PersistentVolumeClaim (PVC) |
|--------|----------------------|----------------------------|
| **What is it?** | The actual storage | Request for storage |
| **Who creates?** | Admin/Helm chart | StatefulSet/Deployment |
| **Scope** | Cluster-wide | Namespace-specific |
| **Analogy** | The apartment | Rental application |
| **Contains** | Storage location | Storage requirements |
| **Example** | "20GB at /home/sai/mongo_data" | "I need 20GB" |

---

## 🔄 Lifecycle Example

### Scenario: What Happens When...

#### 1. Pod Restarts
```
mongodb-0 crashes ❌
    ↓
Pod deleted
    ↓
StatefulSet creates new mongodb-0 ✅
    ↓
New pod requests same PVC: data-mongodb-0
    ↓
PVC still bound to PV: mongodb-pv ✅
    ↓
PV still points to /home/sai/mongo_data ✅
    ↓
Data intact! ✅
```

#### 2. StatefulSet Scaled
```
$ kubectl scale statefulset mongodb --replicas=3

Creates:
- mongodb-0 → PVC: data-mongodb-0 → New PV-1 → /mongo_data/replica-0
- mongodb-1 → PVC: data-mongodb-1 → New PV-2 → /mongo_data/replica-1
- mongodb-2 → PVC: data-mongodb-2 → New PV-3 → /mongo_data/replica-2

Each pod gets its own PVC → PV → Storage!
```

#### 3. PVC Deleted
```
$ kubectl delete pvc data-mongodb-0 -n production

PVC deleted ❌
    ↓
Binding broken
    ↓
What happens to PV?
    ├─ If ReclaimPolicy: Retain → PV kept, data safe ✅
    ├─ If ReclaimPolicy: Delete → PV deleted, data lost ❌
    └─ If ReclaimPolicy: Recycle → PV wiped, ready for reuse

Your setup: Retain ✅ (data is safe!)

What happens to host directory?
    └─ /home/sai/mongo_data/ → ALWAYS KEPT ✅
       (You must manually delete if needed)
```

---

## 🎓 Common Confusion Clarified

### Confusion 1: "Are PV and PVC two copies of data?"
❌ **NO!** They're not copies.

```
Think of it as:
PV = The storage locker (physical space)
PVC = The key to that locker
Pod = Person using the key to access the locker

There's only ONE locker (one set of files).
The key just gives you access to it.
```

### Confusion 2: "Why do we need both PV and PVC?"
✅ **Separation of concerns:**

```
Admin's job (PV):
- "I have 100GB available at /storage/location"
- "I have SSD storage"
- "I have network storage"

Developer's job (PVC):
- "My app needs 20GB"
- "I don't care where it is"
- "Just give me storage"

Kubernetes matches them!
```

### Confusion 3: "What if I delete the pod?"
```
Delete pod → PVC stays ✅
PVC stays → PV stays ✅
PV stays → Data stays ✅

To lose data, you'd need to:
1. Delete the pod ❌
2. Delete the PVC ❌
3. Delete the PV ❌
4. Delete the host directory ❌

Very hard to accidentally lose data!
```

---

## 🛠️ Verify PV and PVC in Your Setup

### Check what was created:
```bash
# 1. Check PV (cluster-wide)
kubectl get pv

NAME         CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM
mongodb-pv   20Gi       RWO            Retain           Bound    production/data-mongodb-0
```

### Check PVC (namespace-specific):
```bash
# 2. Check PVC
kubectl get pvc -n production

NAME              STATUS   VOLUME       CAPACITY   ACCESS MODES
data-mongodb-0    Bound    mongodb-pv   20Gi       RWO
```

### Check binding:
```bash
# 3. See the connection
kubectl describe pvc data-mongodb-0 -n production

Name:          data-mongodb-0
Namespace:     production
Status:        Bound                    ← PVC is bound
Volume:        mongodb-pv               ← To this PV
Capacity:      20Gi
Access Modes:  RWO
Used By:       mongodb-0                ← By this pod
```

### Check what the pod sees:
```bash
# 4. Inside the pod
kubectl exec mongodb-0 -n production -- df -h /data/db

Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        20G  128M   19G   1% /data/db
                 ↑                      ↑
                 PV size                Where MongoDB writes
```

---

## 🎯 Summary - The Simple Truth

**PV (PersistentVolume):**
- "I have storage here: `/home/sai/mongo_data`"
- Created by admin/Helm chart
- Cluster-wide resource

**PVC (PersistentVolumeClaim):**
- "I need storage, please!"
- Created by StatefulSet for each pod
- Namespace-specific

**The Magic:**
```
Pod writes to: /data/db
    ↓ (mounted from)
PVC: data-mongodb-0
    ↓ (bound to)
PV: mongodb-pv
    ↓ (maps to)
Host: /home/sai/mongo_data

All the same data! Just different "names" for accessing it.
```

**Think of it like:**
- **PV** = Your house address (123 Main St)
- **PVC** = Your house key
- **Pod** = You (the person)
- **Writing data** = Putting furniture in the house

The house exists (PV), you have the key (PVC), and you use it (Pod). Only one house, just different ways to reference it! 🏠
