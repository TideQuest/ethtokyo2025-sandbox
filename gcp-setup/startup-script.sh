#!/bin/bash
set -e

# =============================================================================
# VM Startup Script for Docker Compose Application
# This script runs automatically when the VM starts
# =============================================================================

# Log all output
exec > >(tee -a /var/log/startup-script.log)
exec 2>&1

echo "==========================================="
echo "Starting deployment at $(date)"
echo "==========================================="

# Update system packages
echo "Updating system packages..."
apt-get update

# Install Docker if not present (Container-Optimized OS has Docker pre-installed)
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Install Docker Compose plugin
if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose plugin..."
    apt-get install -y docker-compose-plugin
fi

# Install essential tools
echo "Installing essential tools..."
apt-get install -y git curl wget nano htop

# Create application directory
echo "Creating application directory..."
mkdir -p /opt/app
cd /opt/app

# Clone or update repository
if [ ! -d "ethtokyo2025-sandbox" ]; then
    echo "Cloning repository..."
    git clone https://github.com/TideQuest/ethtokyo2025-sandbox.git
    cd ethtokyo2025-sandbox
else
    echo "Repository exists, pulling latest changes..."
    cd ethtokyo2025-sandbox
    # Stash any local changes
    git stash
    # Pull latest changes
    git pull origin main || {
        echo "Failed to pull latest changes, continuing with existing code..."
    }
fi

# Create default .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating default .env file..."
    cat > .env <<'ENV_CONFIG'
# Database Configuration
POSTGRES_USER=zksteam_user
POSTGRES_PASSWORD=zksteam_password_$(openssl rand -hex 16)
POSTGRES_DB=zksteam_db
DATABASE_URL=postgresql://zksteam_user:zksteam_password_$(openssl rand -hex 16)@db:5432/zksteam_db

# Ollama Configuration
OLLAMA_MODEL=llama3.2:1b
OLLAMA_URL=http://ollama:11434

# Application Configuration
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 32)
VITE_BACKEND_URL=http://localhost:3000

# External URL (update with your domain or external IP)
EXTERNAL_URL=http://localhost:8080

# Additional Settings
PORT=3000
FRONTEND_PORT=5173
ENV_CONFIG

    echo "⚠️  IMPORTANT: Default .env created with random passwords"
    echo "⚠️  Please update the passwords and configuration in /opt/app/ethtokyo2025-sandbox/.env"
fi

# Stop any existing containers
echo "Stopping any existing containers..."
docker compose down || true

# Pull latest images
echo "Pulling latest Docker images..."
docker compose pull

# Start all services
echo "Starting Docker Compose services..."
docker compose up -d

# Wait for services to be ready
echo "Waiting for services to initialize..."
sleep 30

# Check if Ollama is running and pull model
echo "Setting up Ollama..."
if docker compose ps | grep -q ollama; then
    echo "Pulling Ollama model..."
    # Try to pull the model using the init service
    docker compose run --rm ollama-init || {
        echo "Failed to pull model via init service, trying direct approach..."
        docker exec zksteam_ollama ollama pull llama3.2:1b || {
            echo "Failed to pull Ollama model, please do it manually later"
        }
    }
else
    echo "Ollama service not found, skipping model pull"
fi

# Show service status
echo "==========================================="
echo "Service Status:"
docker compose ps
echo "==========================================="

# Setup log rotation
echo "Setting up log rotation..."
cat > /etc/logrotate.d/docker-containers <<'LOGROTATE_CONFIG'
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size 100M
    missingok
    delaycompress
    copytruncate
}
LOGROTATE_CONFIG

# Create monitoring script
echo "Creating monitoring script..."
cat > /usr/local/bin/check-services.sh <<'MONITOR_SCRIPT'
#!/bin/bash
# Simple monitoring script to check if services are running

check_service() {
    local service=$1
    if docker compose ps | grep -q "$service.*Up"; then
        echo "✅ $service is running"
    else
        echo "❌ $service is down"
        # Try to restart the service
        docker compose restart $service
    fi
}

cd /opt/app/ethtokyo2025-sandbox
check_service "db"
check_service "ollama"
check_service "backend"
check_service "frontend"
MONITOR_SCRIPT

chmod +x /usr/local/bin/check-services.sh

# Add monitoring to cron (check every 5 minutes)
(crontab -l 2>/dev/null || true; echo "*/5 * * * * /usr/local/bin/check-services.sh >> /var/log/service-monitor.log 2>&1") | crontab -

# Create update script
echo "Creating update script..."
cat > /usr/local/bin/update-app.sh <<'UPDATE_SCRIPT'
#!/bin/bash
# Script to update the application

cd /opt/app/ethtokyo2025-sandbox
echo "Pulling latest changes..."
git pull origin main

echo "Rebuilding and restarting services..."
docker compose down
docker compose up -d --build

echo "Update complete!"
docker compose ps
UPDATE_SCRIPT

chmod +x /usr/local/bin/update-app.sh

# Print success message
echo "==========================================="
echo "✅ Deployment completed successfully at $(date)"
echo "==========================================="
echo ""
echo "📝 Important files:"
echo "  - Application: /opt/app/ethtokyo2025-sandbox"
echo "  - Environment: /opt/app/ethtokyo2025-sandbox/.env"
echo "  - Logs: /var/log/startup-script.log"
echo ""
echo "🔧 Useful commands:"
echo "  - Check services: docker compose ps"
echo "  - View logs: docker compose logs -f"
echo "  - Update app: /usr/local/bin/update-app.sh"
echo "  - Check health: /usr/local/bin/check-services.sh"
echo ""
echo "🌐 Access URLs:"
echo "  - Frontend: http://<EXTERNAL_IP>:5173"
echo "  - Backend: http://<EXTERNAL_IP>:3000"
echo "  - Nginx: http://<EXTERNAL_IP>:8080"
echo "==========================================="