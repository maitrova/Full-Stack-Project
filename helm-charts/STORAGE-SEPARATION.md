# Storage Separation - PV Architecture

## 🎯 Why Separate PVs Are Important

Each service gets its own isolated storage. This prevents:
- Data corruption between services
- Permission conflicts
- Accidental data deletion
- Storage quota issues

---

## 📊 Current Architecture (After Changes)

```
Your VPS Host Filesystem
├── /home/sai/mongo_data/          ← MongoDB's dedicated storage
│   ├── collection-0.wt
│   ├── index-1.wt
│   ├── WiredTiger.wt
│   └── journal/
│       └── WiredTigerLog.0001
│
└── /home/sai/caddy_data/          ← Caddy's dedicated storage
    ├── certificates/
    │   ├── acme-v02.api.letsencrypt.org/
    │   │   └── maitrova.in/
    │   │       ├── maitrova.in.crt
    │   │       └── maitrova.in.key
    └── locks/

K8s Cluster
├── PV: mongodb-pv
│   └── hostPath: /home/sai/mongo_data
│       └── Bound to PVC: data-mongodb-0
│           └── Mounted by Pod: mongodb-0 at /data/db
│
└── PV: caddy-pv
    └── hostPath: /home/sai/caddy_data
        └── Bound to PVC: caddy-data
            └── Mounted by Pod: caddy-xyz at /data
```

---

## 🔐 Storage Isolation Benefits

### MongoDB PV
```yaml
PV: mongodb-pv
├── Path: /home/sai/mongo_data
├── Size: 20Gi
├── Owner: 999:999 (mongodb user)
├── Purpose: Database files
└── Reclaim Policy: Retain

Benefits:
✓ Database files isolated
✓ Can backup independently
✓ Proper permissions for MongoDB
✓ 20GB dedicated space
```

### Caddy PV
```yaml
PV: caddy-pv
├── Path: /home/sai/caddy_data
├── Size: 1Gi
├── Owner: 1000:1000 (caddy user)
├── Purpose: SSL certificates
└── Reclaim Policy: Retain

Benefits:
✓ SSL certs isolated
✓ Auto-renewal works safely
✓ Proper permissions for Caddy
✓ 1GB is plenty for certs
```

---

## 🎯 Complete Storage Flow

### MongoDB Storage Flow
```
Backend API writes data
    ↓
MongoDB Pod (mongodb-0)
    ↓
Writes to: /data/db
    ↓
Mounted from PVC: data-mongodb-0
    ↓
Bound to PV: mongodb-pv
    ↓
Maps to hostPath: /home/sai/mongo_data/
    ↓
Physical files: collection-0.wt, index-1.wt, etc.
```

### Caddy Storage Flow
```
Let's Encrypt issues SSL cert
    ↓
Caddy Pod (caddy-abc123)
    ↓
Writes to: /data/certificates/
    ↓
Mounted from PVC: caddy-data
    ↓
Bound to PV: caddy-pv
    ↓
Maps to hostPath: /home/sai/caddy_data/
    ↓
Physical files: maitrova.in.crt, .key, etc.
```

---

## 🛡️ Safety Features

### Separate Directories = Separate Backups
```bash
# Backup MongoDB separately
sudo tar -czf mongodb-backup.tar.gz /home/sai/mongo_data/

# Backup Caddy certs separately
sudo tar -czf caddy-backup.tar.gz /home/sai/caddy_data/

# Restore only what you need
```

### Separate PVs = Independent Lifecycle
```bash
# Delete MongoDB (data kept)
helm uninstall mongodb -n production
# /home/sai/mongo_data/ → Still there ✓

# Delete Caddy (certs kept)
helm uninstall caddy -n production
# /home/sai/caddy_data/ → Still there ✓

# Each service's data is independent!
```

### Separate Permissions = Better Security
```bash
# MongoDB directory
drwxr-xr-x  999  999  /home/sai/mongo_data/
# Only MongoDB pod (UID 999) can write

# Caddy directory
drwxr-xr-x 1000 1000  /home/sai/caddy_data/
# Only Caddy pod (UID 1000) can write

# They can't access each other's data!
```

---

## 📋 Setup Commands

### Manual Setup (if needed)
```bash
# Create MongoDB storage
sudo mkdir -p /home/sai/mongo_data
sudo chown -R 999:999 /home/sai/mongo_data
sudo chmod 755 /home/sai/mongo_data

# Create Caddy storage
sudo mkdir -p /home/sai/caddy_data
sudo chown -R 1000:1000 /home/sai/caddy_data
sudo chmod 755 /home/sai/caddy_data
```

### Verify Setup
```bash
# Check directories
ls -la /home/sai/

drwxr-xr-x  999  999 mongo_data    ← MongoDB
drwxr-xr-x 1000 1000 caddy_data    ← Caddy

# Check PVs
kubectl get pv

NAME         CAPACITY   STATUS   CLAIM
mongodb-pv   20Gi       Bound    production/data-mongodb-0
caddy-pv     1Gi        Bound    production/caddy-data

# Check PVCs
kubectl get pvc -n production

NAME              STATUS   VOLUME       CAPACITY
data-mongodb-0    Bound    mongodb-pv   20Gi
caddy-data        Bound    caddy-pv     1Gi
```

---

## 🔍 What Changed?

### Before (Unsafe - Shared Storage)
```
❌ Both could use same PV
❌ K3s dynamic provisioning (less control)
❌ No dedicated paths
❌ Risk of conflicts
```

### After (Safe - Separate Storage)
```
✅ MongoDB: /home/sai/mongo_data → mongodb-pv
✅ Caddy:   /home/sai/caddy_data → caddy-pv
✅ Explicit PV definitions
✅ Complete isolation
✅ Independent backups
✅ Clear ownership
```

---

## 🎓 Best Practices Applied

1. **Isolation** - Each service has dedicated storage
2. **Security** - Proper permissions per service
3. **Recoverability** - Independent backups
4. **Clarity** - Clear directory structure
5. **Safety** - Retain policy prevents data loss

---

## 📊 Storage Summary

| Service | PV Name | Host Path | Size | Owner | Purpose |
|---------|---------|-----------|------|-------|---------|
| MongoDB | mongodb-pv | /home/sai/mongo_data | 20Gi | 999:999 | Database files |
| Caddy | caddy-pv | /home/sai/caddy_data | 1Gi | 1000:1000 | SSL certificates |

**Total Host Storage Used**: ~21Gi (when full)

---

## ✅ Verification Checklist

After deployment, verify:

```bash
# 1. Check both directories exist
ls -la /home/sai/ | grep -E "mongo_data|caddy_data"

# 2. Check both PVs created
kubectl get pv | grep -E "mongodb-pv|caddy-pv"

# 3. Check both PVCs bound
kubectl get pvc -n production

# 4. Check MongoDB data files
sudo ls /home/sai/mongo_data/

# 5. Check Caddy cert files (after SSL issued)
sudo ls /home/sai/caddy_data/certificates/

# 6. Check permissions
stat /home/sai/mongo_data/ | grep Uid
stat /home/sai/caddy_data/ | grep Uid
```

---

## 🎉 Result

You now have:
- ✅ **Completely isolated storage** per service
- ✅ **Safe data persistence** with Retain policy
- ✅ **Clear organization** on host filesystem
- ✅ **Independent backups** possible
- ✅ **Production-ready architecture**

This is the **correct and safe** way to configure storage! 🚀
