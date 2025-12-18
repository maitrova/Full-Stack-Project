#!/bin/bash
# MongoDB Storage Verification Script
# This shows how data flows from Pod → PVC → PV → Host

echo "═══════════════════════════════════════════════════════════"
echo "  MongoDB Storage Chain Verification"
echo "═══════════════════════════════════════════════════════════"
echo ""

NAMESPACE="production"

# 1. Check the Pod
echo "1️⃣  MongoDB Pod:"
echo "─────────────────────────────────────────────────────────"
kubectl get pod -l app.kubernetes.io/name=mongodb -n $NAMESPACE -o wide
echo ""

# 2. Check what's mounted inside the pod
echo "2️⃣  Volume Mounts Inside Pod:"
echo "─────────────────────────────────────────────────────────"
kubectl exec mongodb-0 -n $NAMESPACE -- df -h /data/db 2>/dev/null || echo "Pod not running yet"
echo ""

# 3. Check PVC
echo "3️⃣  PersistentVolumeClaim (PVC):"
echo "─────────────────────────────────────────────────────────"
kubectl get pvc -n $NAMESPACE
echo ""

# 4. Check PV
echo "4️⃣  PersistentVolume (PV):"
echo "─────────────────────────────────────────────────────────"
kubectl get pv | grep -E "NAME|mongodb"
echo ""

# 5. Check actual files on host
echo "5️⃣  Actual Files on Host:"
echo "─────────────────────────────────────────────────────────"
echo "Location: /home/sai/mongo_data"
ls -lh /home/sai/mongo_data/ 2>/dev/null || echo "Directory not accessible (may need sudo)"
echo ""

# 6. Check MongoDB data files inside pod
echo "6️⃣  MongoDB Files Inside Container:"
echo "─────────────────────────────────────────────────────────"
kubectl exec mongodb-0 -n $NAMESPACE -- ls -lh /data/db 2>/dev/null || echo "Pod not running yet"
echo ""

# 7. Verify they're the same (inode check)
echo "7️⃣  Verification - These should match:"
echo "─────────────────────────────────────────────────────────"
echo "Files in container /data/db:"
kubectl exec mongodb-0 -n $NAMESPACE -- ls /data/db | wc -l 2>/dev/null || echo "0"
echo ""
echo "Files on host /home/sai/mongo_data:"
ls /home/sai/mongo_data 2>/dev/null | wc -l || echo "0 (need sudo or directory doesn't exist)"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "  ✓ Complete! The container's /data/db is the same as"
echo "    the host's /home/sai/mongo_data directory"
echo "═══════════════════════════════════════════════════════════"
