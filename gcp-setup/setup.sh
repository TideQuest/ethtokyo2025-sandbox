#!/bin/bash
set -e

# =============================================================================
# GCP Docker Compose Deployment Setup Script
# This script deploys the zksteam application to GCP using only gcloud commands
# =============================================================================

# Configuration Variables
PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-us-central1}"
ZONE="${GCP_ZONE:-us-central1-a}"
INSTANCE_NAME="${INSTANCE_NAME:-zksteam-app-vm}"
MACHINE_TYPE="${MACHINE_TYPE:-e2-medium}"
DISK_SIZE="${DISK_SIZE:-50}"
NETWORK_TAGS="web,db,ai"
SERVICE_ACCOUNT_NAME="vm-service-account"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${GREEN}=============================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}=============================================${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_requirements() {
    print_header "Checking Requirements"

    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI is not installed. Please install it first."
        echo "Visit: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi

    if [ -z "$PROJECT_ID" ]; then
        print_error "GCP_PROJECT_ID environment variable is not set."
        echo "Please run: export GCP_PROJECT_ID=your-project-id"
        exit 1
    fi

    print_success "All requirements met"
}

setup_project() {
    print_header "Setting up GCP Project"

    gcloud config set project "$PROJECT_ID"

    # Enable required APIs
    echo "Enabling required APIs..."
    gcloud services enable compute.googleapis.com
    gcloud services enable iam.googleapis.com
    gcloud services enable logging.googleapis.com
    gcloud services enable dns.googleapis.com

    print_success "Project setup complete"
}

create_service_account() {
    print_header "Creating Service Account"

    # Check if service account exists
    if gcloud iam service-accounts describe "${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" &>/dev/null; then
        print_warning "Service account already exists, skipping creation"
    else
        gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
            --display-name="VM Service Account for Docker Compose deployment"

        # Grant necessary permissions
        gcloud projects add-iam-policy-binding "$PROJECT_ID" \
            --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
            --role="roles/logging.logWriter"

        print_success "Service account created"
    fi
}

create_firewall_rules() {
    print_header "Creating Firewall Rules"

    # HTTP and HTTPS
    gcloud compute firewall-rules create allow-http \
        --allow tcp:80 \
        --source-ranges 0.0.0.0/0 \
        --target-tags web \
        --description "Allow HTTP traffic" \
        2>/dev/null || print_warning "Firewall rule 'allow-http' already exists"

    gcloud compute firewall-rules create allow-https \
        --allow tcp:443 \
        --source-ranges 0.0.0.0/0 \
        --target-tags web \
        --description "Allow HTTPS traffic" \
        2>/dev/null || print_warning "Firewall rule 'allow-https' already exists"

    # Application ports
    gcloud compute firewall-rules create allow-app-ports \
        --allow tcp:3000,tcp:5173,tcp:8080 \
        --source-ranges 0.0.0.0/0 \
        --target-tags web \
        --description "Allow application ports" \
        2>/dev/null || print_warning "Firewall rule 'allow-app-ports' already exists"

    # PostgreSQL (WARNING: Restrict in production!)
    gcloud compute firewall-rules create allow-postgres \
        --allow tcp:5432 \
        --source-ranges 0.0.0.0/0 \
        --target-tags db \
        --description "Allow PostgreSQL (RESTRICT IN PRODUCTION!)" \
        2>/dev/null || print_warning "Firewall rule 'allow-postgres' already exists"

    # Ollama
    gcloud compute firewall-rules create allow-ollama \
        --allow tcp:11434 \
        --source-ranges 0.0.0.0/0 \
        --target-tags ai \
        --description "Allow Ollama API (RESTRICT IN PRODUCTION!)" \
        2>/dev/null || print_warning "Firewall rule 'allow-ollama' already exists"

    print_success "Firewall rules created"
    print_warning "Remember to restrict PostgreSQL and Ollama ports in production!"
}

reserve_static_ip() {
    print_header "Reserving Static IP Address"

    # Check if static IP exists
    if gcloud compute addresses describe tidequest-static-ip --region="$REGION" &>/dev/null; then
        print_warning "Static IP already exists"
        STATIC_IP=$(gcloud compute addresses describe tidequest-static-ip --region="$REGION" --format="value(address)")
    else
        gcloud compute addresses create tidequest-static-ip \
            --region="$REGION" \
            --description="Static IP for zksteam application"

        STATIC_IP=$(gcloud compute addresses describe tidequest-static-ip --region="$REGION" --format="value(address)")
        print_success "Static IP reserved: $STATIC_IP"
    fi
}

create_startup_script() {
    print_header "Creating Startup Script"

    cat > /tmp/startup-script.sh << 'STARTUP_SCRIPT'
#!/bin/bash
set -e

# Log output
exec > >(tee -a /var/log/startup-script.log)
exec 2>&1

echo "Starting deployment at $(date)"

# Update system
apt-get update

# Install Docker and Docker Compose if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
fi

# Install Docker Compose plugin
if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose..."
    apt-get install -y docker-compose-plugin
fi

# Install git
apt-get install -y git

# Create working directory
mkdir -p /opt/app
cd /opt/app

# Clone the repository
if [ ! -d "ethtokyo2025-sandbox" ]; then
    echo "Cloning repository..."
    git clone https://github.com/TideQuest/ethtokyo2025-sandbox.git
else
    echo "Repository already exists, pulling latest changes..."
    cd ethtokyo2025-sandbox
    git pull origin main || true
    cd ..
fi

cd ethtokyo2025-sandbox

# Create .env file with defaults if not exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env <<'ENV_FILE'
# Database Configuration
POSTGRES_USER=zksteam_user
POSTGRES_PASSWORD=zksteam_password_change_me
POSTGRES_DB=zksteam_db
DATABASE_URL=postgresql://zksteam_user:zksteam_password_change_me@db:5432/zksteam_db

# Ollama Configuration
OLLAMA_MODEL=llama3.2:1b
OLLAMA_URL=http://ollama:11434

# Application Configuration
NODE_ENV=production
JWT_SECRET=your-jwt-secret-change-me
VITE_BACKEND_URL=http://localhost:3000

# External URL (update with your domain or IP)
EXTERNAL_URL=http://localhost:8080
ENV_FILE
fi

# Start services with Docker Compose
echo "Starting Docker Compose services..."
docker compose up -d

# Wait for Ollama to be healthy
echo "Waiting for Ollama to be ready..."
sleep 30

# Pull Ollama model
echo "Pulling Ollama model..."
docker compose run --rm ollama-init || true

# Check service status
echo "Checking service status..."
docker compose ps

# Setup log rotation
cat > /etc/logrotate.d/docker-containers <<'LOGROTATE'
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    missingok
    delaycompress
    copytruncate
}
LOGROTATE

echo "Deployment completed successfully at $(date)"
echo "You can check the logs at: /var/log/startup-script.log"
echo "Application status: docker compose ps"
STARTUP_SCRIPT

    print_success "Startup script created at /tmp/startup-script.sh"
}

create_vm_instance() {
    print_header "Creating VM Instance"

    # Check if instance exists
    if gcloud compute instances describe "$INSTANCE_NAME" --zone="$ZONE" &>/dev/null; then
        print_warning "Instance already exists. Do you want to delete and recreate it? (y/n)"
        read -r response
        if [[ "$response" == "y" ]]; then
            echo "Deleting existing instance..."
            gcloud compute instances delete "$INSTANCE_NAME" --zone="$ZONE" --quiet
        else
            print_warning "Skipping VM creation"
            return
        fi
    fi

    echo "Creating VM instance..."
    gcloud compute instances create "$INSTANCE_NAME" \
        --zone="$ZONE" \
        --machine-type="$MACHINE_TYPE" \
        --network-interface="address=$STATIC_IP,network-tier=PREMIUM,subnet=default" \
        --boot-disk-size="$DISK_SIZE" \
        --boot-disk-type=pd-standard \
        --boot-disk-device-name="$INSTANCE_NAME" \
        --image-family=cos-stable \
        --image-project=cos-cloud \
        --maintenance-policy=MIGRATE \
        --provisioning-model=STANDARD \
        --service-account="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
        --scopes=https://www.googleapis.com/auth/cloud-platform \
        --tags="$NETWORK_TAGS" \
        --metadata-from-file startup-script=/tmp/startup-script.sh \
        --metadata enable-oslogin=TRUE \
        --labels=environment=production,app=zksteam

    print_success "VM instance created"
}

wait_for_startup() {
    print_header "Waiting for Startup Script"

    echo "Waiting for instance to be ready..."
    sleep 30

    echo "Checking startup script progress..."
    echo "You can monitor the progress with:"
    echo "  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='tail -f /var/log/startup-script.log'"
    echo ""
    echo "Waiting 2 minutes for initial setup..."

    for i in {1..24}; do
        echo -n "."
        sleep 5
    done
    echo ""

    print_success "Initial setup should be complete"
}

print_access_info() {
    print_header "Access Information"

    echo "Instance Name: $INSTANCE_NAME"
    echo "Zone: $ZONE"
    echo "External IP: $STATIC_IP"
    echo ""
    echo "SSH Access:"
    echo "  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
    echo ""
    echo "Application URLs:"
    echo "  Frontend: http://$STATIC_IP:5173"
    echo "  Backend API: http://$STATIC_IP:3000"
    echo "  Nginx (if enabled): http://$STATIC_IP:8080"
    echo ""
    echo "Database Access (from VM):"
    echo "  psql postgresql://zksteam_user:zksteam_password_change_me@localhost:5432/zksteam_db"
    echo ""
    echo "Ollama API:"
    echo "  http://$STATIC_IP:11434"
}

print_next_steps() {
    print_header "Next Steps"

    cat << NEXT_STEPS
1. SSH into the VM:
   gcloud compute ssh $INSTANCE_NAME --zone=$ZONE

2. Check Docker containers:
   sudo docker ps
   cd /opt/app/ethtokyo2025-sandbox
   sudo docker compose logs -f

3. Update environment variables:
   sudo nano /opt/app/ethtokyo2025-sandbox/.env
   sudo docker compose restart

4. For production, restrict firewall rules:
   # Restrict PostgreSQL access
   gcloud compute firewall-rules update allow-postgres \\
     --source-ranges="YOUR_IP/32"

   # Restrict Ollama access
   gcloud compute firewall-rules update allow-ollama \\
     --source-ranges="YOUR_IP/32"

5. Setup domain (optional):
   # Create DNS zone
   gcloud dns managed-zones create tidequest-zone \\
     --dns-name="yourdomain.com." \\
     --description="DNS zone for application"

   # Add A record
   gcloud dns record-sets create app.yourdomain.com. \\
     --zone=tidequest-zone \\
     --type=A \\
     --ttl=300 \\
     --rrdatas=$STATIC_IP

6. Monitor costs:
   gcloud compute instances list

   # Stop instance when not needed
   gcloud compute instances stop $INSTANCE_NAME --zone=$ZONE

   # Start when needed
   gcloud compute instances start $INSTANCE_NAME --zone=$ZONE
NEXT_STEPS
}

# Main execution
main() {
    print_header "GCP Docker Compose Deployment Setup"

    check_requirements
    setup_project
    create_service_account
    create_firewall_rules
    reserve_static_ip
    create_startup_script
    create_vm_instance
    wait_for_startup
    print_access_info
    print_next_steps

    print_header "Setup Complete!"
    print_success "Your application should be accessible at: http://$STATIC_IP:5173"
}

# Run main function
main "$@"