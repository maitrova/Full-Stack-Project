# Deployment Steps for K3s Cluster

Follow these steps in order to deploy your application to K3s.

## Prerequisites
- Lens connected to your K3s cluster
- Helm charts ready in `/Users/NYannam/devops-repos/Full-Stack-Project/helm-charts`

---

## Step 1: SSH to VPS and Create Storage Directories

```bash
ssh user@your-vps-ip
sudo mkdir -p /home/sai/mongo_data
sudo mkdir -p /home/sai/caddy_data
sudo chown -R 999:999 /home/sai/mongo_data    # MongoDB user
sudo chown -R 1000:1000 /home/sai/caddy_data  # Caddy user
sudo chmod 755 /home/sai/mongo_data
sudo chmod 755 /home/sai/caddy_data
exit
```

---

## Step 2: Open Lens Terminal

1. Open Lens application
2. Connect to your K3s cluster
3. Click terminal icon (`) at bottom to open terminal
4. Navigate to helm charts directory:
   ```bash
   cd /Users/NYannam/devops-repos/Full-Stack-Project/helm-charts
   ```

---

## Step 3: Create Namespace

```bash
kubectl create namespace production
```

**Verify:**
```bash
kubectl get namespaces
```
You should see `production` in the list.

---

## Step 4: Create Docker Registry Secret

```bash
kubectl apply -f docker-registry-secret.yaml
```

**Verify:**
```bash
kubectl get secret docker-registry-secret -n production
```

---

## Step 5: Deploy MongoDB

```bash
helm install mongodb ./mongodb -n production
```

**Wait and verify:**
```bash
kubectl get pods -n production -w
# Wait until mongodb-0 is Running (press Ctrl+C to stop watching)

kubectl get pv
kubectl get pvc -n production
```

**Check MongoDB logs:**
```bash
kubectl logs mongodb-0 -n production
```

---

## Step 6: Deploy Backend

```bash
helm install backend ./backend -n production
```

**Verify:**
```bash
kubectl get pods -n production
kubectl get hpa -n production
```

**Check backend logs:**
```bash
kubectl logs -l app.kubernetes.io/name=backend -n production
```

---

## Step 7: Deploy Frontend

```bash
helm install frontend ./frontend -n production
```

**Verify:**
```bash
kubectl get pods -n production
kubectl get hpa -n production
```

---

## Step 8: Deploy Caddy

```bash
helm install caddy ./caddy -n production
```

**Verify:**
```bash
kubectl get pods -n production
kubectl get svc -n production
```

**Get LoadBalancer IP:**
```bash
kubectl get svc caddy -n production -o wide
```
Note the EXTERNAL-IP - this is where you'll point your domain.

---

## Step 9: Verify Everything is Running

```bash
kubectl get all -n production
```

**Expected output:**
- mongodb-0: Running
- backend-xxx: 2 pods Running
- frontend-xxx: 2 pods Running
- caddy-xxx: 2 pods Running

---

## Step 10: Configure DNS

Point your domain `narifighter.online` to the LoadBalancer EXTERNAL-IP from Step 8.

**DNS Records:**
- A record: `narifighter.online` → `EXTERNAL-IP`
- A record: `www.narifighter.online` → `EXTERNAL-IP`

Wait 5-10 minutes for DNS propagation and Caddy to obtain SSL certificate.

---

## Step 11: Test the Application

```bash
# Test frontend
curl https://narifighter.online

# Test backend API
curl https://narifighter.online/api/health
```

---

## Troubleshooting Commands

```bash
# Check pod status
kubectl get pods -n production

# View pod logs
kubectl logs POD_NAME -n production

# Describe pod for events
kubectl describe pod POD_NAME -n production

# Check services
kubectl get svc -n production

# Check PVs and PVCs
kubectl get pv
kubectl get pvc -n production

# Check HPA status
kubectl get hpa -n production

# Port forward for testing (if LoadBalancer not working)
kubectl port-forward svc/caddy 8080:80 -n production
# Then visit: http://localhost:8080
```

---

## Uninstall (if needed)

```bash
helm uninstall caddy -n production
helm uninstall frontend -n production
helm uninstall backend -n production
helm uninstall mongodb -n production
kubectl delete namespace production
```

---

## Current Configuration Summary

- **Namespace:** production
- **MongoDB:** 1 replica, 20Gi storage at /home/sai/mongo_data
- **Backend:** 2-5 replicas (HPA enabled), connects to mongodb:27017
- **Frontend:** 2-5 replicas (HPA enabled)
- **Caddy:** 2 replicas, LoadBalancer on ports 80/443, SSL for narifighter.online
- **Domain:** narifighter.online
- **Docker Images:** docker.io/maitrova/maitrova:backend, docker.io/maitrova/maitrova:frontend
