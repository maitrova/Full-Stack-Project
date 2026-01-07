# Quick Reference - CRUD Application

## Project Structure

```
curd-operations/
├── backend/                    # Node.js Express API
│   ├── Dockerfile
│   ├── models/
│   ├── routes/
│   └── server.js
├── frontend/                   # React Application
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── public/
│   └── src/
├── docker-compose.yml          # Local Docker development
└── helm/                       # Kubernetes deployment
    └── crud-app/
        ├── Chart.yaml
        ├── values.yaml
        ├── values-production.yaml
        └── templates/
```

## Quick Commands

### Docker Compose (Local Development)

```bash
# Start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose down && docker-compose up --build -d

# View running containers
docker ps

# Access logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs mongodb
```

**Access locally:**
- Frontend: http://localhost
- Backend: http://localhost:5000
- MongoDB: localhost:27017

---

### Kubernetes (Production)

```bash
# Deploy application
helm install crud-app ./helm/crud-app \
  -f ./helm/crud-app/values-production.yaml \
  -n production

# Upgrade application
helm upgrade crud-app ./helm/crud-app \
  -f ./helm/crud-app/values-production.yaml \
  -n production

# Check status
kubectl get all -n production
kubectl get pods -n production
kubectl get ingress -n production

# View logs
kubectl logs -f deployment/backend -n production
kubectl logs -f deployment/frontend -n production

# Scale services
kubectl scale deployment backend --replicas=5 -n production

# Rollback
helm rollback crud-app -n production

# Uninstall
helm uninstall crud-app -n production
```

**Access production:**
- Frontend: https://narifighter.online
- Backend: https://api.narifighter.online/api

---

## Environment Variables

### Backend

**Local (.env):**
```
MONGODB_URI=mongodb://localhost:27017/crud-app
PORT=5000
```

**Docker Compose:**
```yaml
environment:
  - MONGODB_URI=mongodb://mongodb:27017/crud-app
  - PORT=5000
```

**Kubernetes:**
```yaml
envSecrets:
  MONGODB_URI: "mongodb://mongodb-service:27017/crud-app"
```

### Frontend

**Local (.env):**
```
REACT_APP_API_URL=http://localhost:5000/api
```

**Docker Compose:**
```yaml
args:
  - REACT_APP_API_URL=http://localhost:5000/api
```

**Production (.env.production):**
```
REACT_APP_API_URL=https://api.narifighter.online/api
```

---

## Common Tasks

### Build Docker Images

```bash
# Backend
cd backend
docker build -t your-username/crud-backend:v1.0.0 .
docker push your-username/crud-backend:v1.0.0

# Frontend
cd frontend
docker build -t your-username/crud-frontend:v1.0.0 .
docker push your-username/crud-frontend:v1.0.0
```

### Database Operations

**Local (Docker):**
```bash
# Connect to MongoDB
docker exec -it crud-mongodb mongosh crud-app

# Backup
docker exec crud-mongodb mongodump --out=/tmp/backup
docker cp crud-mongodb:/tmp/backup ./backup

# Restore
docker cp ./backup crud-mongodb:/tmp/backup
docker exec crud-mongodb mongorestore /tmp/backup
```

**Kubernetes:**
```bash
# Connect to MongoDB
kubectl exec -it mongodb-0 -n production -- mongosh crud-app

# Backup
kubectl exec -it mongodb-0 -n production -- mongodump --out=/tmp/backup
kubectl cp production/mongodb-0:/tmp/backup ./backup

# Restore
kubectl cp ./backup production/mongodb-0:/tmp/backup
kubectl exec -it mongodb-0 -n production -- mongorestore /tmp/backup
```

### Debugging

**Check logs:**
```bash
# Docker Compose
docker-compose logs -f backend
docker-compose logs -f frontend

# Kubernetes
kubectl logs -f deployment/backend -n production
kubectl logs -f deployment/frontend -n production
```

**Exec into containers:**
```bash
# Docker Compose
docker exec -it crud-backend sh
docker exec -it crud-frontend sh

# Kubernetes
kubectl exec -it deployment/backend -n production -- sh
kubectl exec -it deployment/frontend -n production -- sh
```

**Check connectivity:**
```bash
# From backend to MongoDB (Docker)
docker exec -it crud-backend sh -c "curl -v mongodb:27017"

# From backend to MongoDB (K8s)
kubectl exec -it deployment/backend -n production -- sh -c "curl -v mongodb-service:27017"
```

---

## Port Mappings

### Docker Compose

| Service  | Container Port | Host Port | Access                    |
|----------|---------------|-----------|---------------------------|
| Frontend | 80            | 80        | http://localhost          |
| Backend  | 5000          | 5000      | http://localhost:5000     |
| MongoDB  | 27017         | 27017     | localhost:27017           |

### Kubernetes

| Service  | Service Name      | Port  | Ingress                        |
|----------|------------------|-------|--------------------------------|
| Frontend | frontend-service | 80    | https://narifighter.online     |
| Backend  | backend-service  | 5000  | https://api.narifighter.online |
| MongoDB  | mongodb-service  | 27017 | Internal only                  |

---

## API Endpoints

```
GET    /api/items      - Get all items
GET    /api/items/:id  - Get single item
POST   /api/items      - Create item
PUT    /api/items/:id  - Update item
DELETE /api/items/:id  - Delete item
```

**Example Request:**
```bash
# Get all items
curl https://api.narifighter.online/api/items

# Create item
curl -X POST https://api.narifighter.online/api/items \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Task",
    "description": "Test Description",
    "category": "Work",
    "status": "Pending",
    "priority": "High"
  }'
```

---

## Troubleshooting Quick Fixes

**Frontend can't connect to backend:**
- Check REACT_APP_API_URL is correct
- Verify backend is running
- Check CORS is enabled in backend

**MongoDB connection failed:**
- Check MongoDB is running: `docker ps` or `kubectl get pods`
- Verify connection string is correct
- Check service name in Kubernetes: `mongodb-service`

**SSL certificate issues:**
- Wait 2-3 minutes for cert-manager
- Check certificate: `kubectl describe certificate -n production`
- Verify DNS is pointing to correct IP

**Port already in use (Docker):**
```bash
# Kill process on port
lsof -ti:5000 | xargs kill -9
lsof -ti:80 | xargs kill -9
```

---

## Helpful Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Kubernetes Documentation](https://kubernetes.io/docs/home/)
- [Helm Documentation](https://helm.sh/docs/)
- [Nginx Ingress](https://kubernetes.github.io/ingress-nginx/)
- [cert-manager](https://cert-manager.io/docs/)
