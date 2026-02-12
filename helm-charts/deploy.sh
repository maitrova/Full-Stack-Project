#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="production"
MONGODB_DATA_PATH="/home/sai/mongo_data"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Full-Stack Application Deployment to K3s                ║${NC}"
echo -e "${BLUE}║   MongoDB + Backend + Frontend + Caddy                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if helm is available
if ! command -v helm &> /dev/null; then
    print_error "helm is not installed. Please install helm first."
    exit 1
fi

# Check if K3s is running
if ! kubectl get nodes &> /dev/null; then
    print_error "Cannot connect to Kubernetes cluster. Is K3s running?"
    exit 1
fi

print_status "Prerequisites checked successfully"
echo ""

# Create namespace if it doesn't exist
print_info "Creating namespace: ${NAMESPACE}"
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
print_status "Namespace ready"
echo ""

# Prepare MongoDB storage
print_info "Preparing MongoDB storage..."
if [ ! -d "${MONGODB_DATA_PATH}" ]; then
    print_warning "MongoDB data directory doesn't exist. Creating: ${MONGODB_DATA_PATH}"
    sudo mkdir -p ${MONGODB_DATA_PATH}
    sudo chown -R 999:999 ${MONGODB_DATA_PATH}
    print_status "MongoDB storage directory created"
else
    print_status "MongoDB storage directory exists"
fi
echo ""

# Prepare Caddy storage
print_info "Preparing Caddy storage..."
CADDY_DATA_PATH="/home/sai/caddy_data"
if [ ! -d "${CADDY_DATA_PATH}" ]; then
    print_warning "Caddy data directory doesn't exist. Creating: ${CADDY_DATA_PATH}"
    sudo mkdir -p ${CADDY_DATA_PATH}
    sudo chown -R 1000:1000 ${CADDY_DATA_PATH}  # Caddy runs as user 1000
    print_status "Caddy storage directory created"
else
    print_status "Caddy storage directory exists"
fi
echo ""

# Deploy MongoDB
print_info "Deploying MongoDB (StatefulSet)..."
helm upgrade --install mongodb ./mongodb \
    --namespace ${NAMESPACE} \
    --wait \
    --timeout 5m

print_status "MongoDB deployed"
echo ""

# Wait for MongoDB to be ready
print_info "Waiting for MongoDB to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=mongodb \
    --namespace ${NAMESPACE} \
    --timeout=300s

print_status "MongoDB is ready"
echo ""

# Deploy Backend
print_info "Deploying Backend API..."
helm upgrade --install backend ./backend \
    --namespace ${NAMESPACE} \
    --wait \
    --timeout 5m

print_status "Backend deployed"
echo ""

# Wait for Backend to be ready
print_info "Waiting for Backend to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=backend \
    --namespace ${NAMESPACE} \
    --timeout=300s

print_status "Backend is ready"
echo ""

# Deploy Frontend
print_info "Deploying Frontend..."
helm upgrade --install frontend ./frontend \
    --namespace ${NAMESPACE} \
    --wait \
    --timeout 5m

print_status "Frontend deployed"
echo ""

# Wait for Frontend to be ready
print_info "Waiting for Frontend to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=frontend \
    --namespace ${NAMESPACE} \
    --timeout=300s

print_status "Frontend is ready"
echo ""

# Deploy Caddy
print_info "Deploying Caddy (Ingress)..."
helm upgrade --install caddy ./caddy \
    --namespace ${NAMESPACE} \
    --wait \
    --timeout 5m

print_status "Caddy deployed"
echo ""

# Wait for Caddy to be ready
print_info "Waiting for Caddy to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=caddy \
    --namespace ${NAMESPACE} \
    --timeout=300s

print_status "Caddy is ready"
echo ""

# Display deployment status
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Deployment Completed Successfully! 🎉                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

print_info "Deployment Summary:"
echo ""
kubectl get all -n ${NAMESPACE}
echo ""

# Get LoadBalancer IP
print_info "Getting LoadBalancer IP for Caddy..."
EXTERNAL_IP=$(kubectl get svc caddy -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

if [ -z "$EXTERNAL_IP" ]; then
    print_warning "LoadBalancer IP not yet assigned. This may take a few moments."
    print_info "Run: kubectl get svc caddy -n ${NAMESPACE} -w"
else
    print_status "LoadBalancer IP: ${EXTERNAL_IP}"
    echo ""
    print_info "Configure your DNS:"
    echo "   maitrova.in → ${EXTERNAL_IP}"
fi

echo ""
print_info "Useful Commands:"
echo "   # Check all resources"
echo "   kubectl get all -n ${NAMESPACE}"
echo ""
echo "   # Check logs"
echo "   kubectl logs -l app.kubernetes.io/name=mongodb -n ${NAMESPACE}"
echo "   kubectl logs -l app.kubernetes.io/name=backend -n ${NAMESPACE} --tail=100 -f"
echo "   kubectl logs -l app.kubernetes.io/name=frontend -n ${NAMESPACE}"
echo "   kubectl logs -l app.kubernetes.io/name=caddy -n ${NAMESPACE} --tail=100 -f"
echo ""
echo "   # Test backend API"
echo "   kubectl port-forward svc/backend 5000:5000 -n ${NAMESPACE}"
echo "   curl http://localhost:5000/api/health"
echo ""
echo "   # Access MongoDB"
echo "   kubectl exec -it mongodb-0 -n ${NAMESPACE} -- mongosh -u maitrova -p"
echo ""
print_status "Deployment script completed!"
