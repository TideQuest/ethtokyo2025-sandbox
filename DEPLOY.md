# GCP Deployment Guide for zksteam Application

## Prerequisites

Before starting, ensure you have:
- GCP account with billing enabled
- `gcloud` CLI installed and configured
- `pulumi` CLI installed
- Node.js and pnpm installed
- A GCP project created

## Initial Setup

### 1. Install Required Tools

```bash
# Install gcloud CLI (macOS)
brew install --cask google-cloud-sdk

# Install Pulumi
brew install pulumi

# Install pnpm
npm install -g pnpm
```

### 2. Configure GCP

```bash
# Login to GCP
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable compute.googleapis.com
gcloud services enable dns.googleapis.com
gcloud services enable serviceusage.googleapis.com

# Create application default credentials
gcloud auth application-default login
```

### 3. Configure Pulumi

```bash
# Login to Pulumi (using local backend)
pulumi login --local

# Or use Pulumi Cloud (free tier available)
pulumi login
```

## Deployment Steps

### 1. Navigate to Pulumi Directory

```bash
cd pulumi
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Create a New Pulumi Stack

```bash
# Create a new stack for your environment
pulumi stack init production

# Set GCP project
pulumi config set gcp:project YOUR_PROJECT_ID

# Optional: Set custom region/zone
pulumi config set region us-central1
pulumi config set zone us-central1-a

# Optional: Set your domain (if you have one)
pulumi config set domain yourdomain.com
pulumi config set subdomain app
```

### 4. Preview Infrastructure

```bash
pulumi preview
```

### 5. Deploy Infrastructure

```bash
pulumi up
```

This will:
- Create a static IP address
- Set up firewall rules
- Create a Compute Engine VM with Container-Optimized OS
- Clone the repository and start Docker containers
- Configure DNS (if domain is set)

### 6. Get Access Information

```bash
# Get the external IP
pulumi stack output externalIp

# Get SSH command
pulumi stack output sshCommand

# Get application URLs
pulumi stack output appUrl
pulumi stack output frontendUrl
pulumi stack output backendUrl
```

## Post-Deployment Configuration

### 1. SSH into the VM

```bash
# Use the SSH command from Pulumi output
gcloud compute ssh zksteam-app-vm --zone=us-central1-a
```

### 2. Check Container Status

```bash
# Check running containers
sudo docker ps

# View logs
cd /opt/app/ethtokyo2025-sandbox
sudo docker compose logs -f

# Check specific service
sudo docker compose logs backend -f
```

### 3. Update Environment Variables

```bash
# Edit the .env file
sudo nano /opt/app/ethtokyo2025-sandbox/.env

# Restart services after changes
sudo docker compose restart
```

### 4. Manual Ollama Model Pull (if needed)

```bash
# Pull additional models
sudo docker exec zksteam_ollama ollama pull llama3.2:3b
sudo docker exec zksteam_ollama ollama pull codellama:7b
```

## Application Updates

### Method 1: Manual Update via SSH

```bash
# SSH into the VM
gcloud compute ssh zksteam-app-vm --zone=us-central1-a

# Navigate to application directory
cd /opt/app/ethtokyo2025-sandbox

# Pull latest changes
sudo git pull origin main

# Rebuild and restart containers
sudo docker compose down
sudo docker compose up -d --build
```

### Method 2: VM Restart (Triggers Startup Script)

```bash
# Restart the VM (will re-run startup script)
gcloud compute instances reset zksteam-app-vm --zone=us-central1-a
```

## Monitoring and Troubleshooting

### Check VM Logs

```bash
# View startup script logs
gcloud compute instances get-serial-port-output zksteam-app-vm --zone=us-central1-a

# View system logs
gcloud logging read "resource.type=gce_instance AND resource.labels.instance_id=$(gcloud compute instances describe zksteam-app-vm --zone=us-central1-a --format='value(id)')" --limit=50
```

### Common Issues and Solutions

#### Containers Not Starting

```bash
# Check Docker status
sudo systemctl status docker

# Check compose logs
cd /opt/app/ethtokyo2025-sandbox
sudo docker compose logs

# Restart Docker
sudo systemctl restart docker
```

#### Database Connection Issues

```bash
# Check database container
sudo docker compose logs db

# Connect to database
sudo docker compose exec db psql -U zksteam_user -d zksteam_db
```

#### Ollama Not Responding

```bash
# Check Ollama status
sudo docker compose logs ollama

# Restart Ollama
sudo docker compose restart ollama

# Test Ollama API
curl http://localhost:11434/api/tags
```

## Security Hardening

### 1. Restrict Firewall Rules

```bash
# Update firewall rules to restrict access
gcloud compute firewall-rules update allow-postgres \
  --source-ranges="YOUR_IP_ADDRESS/32"

gcloud compute firewall-rules update allow-ollama \
  --source-ranges="YOUR_IP_ADDRESS/32"
```

### 2. Enable HTTPS with Let's Encrypt

```bash
# SSH into VM
gcloud compute ssh zksteam-app-vm --zone=us-central1-a

# Install certbot
sudo apt-get update
sudo apt-get install -y certbot

# Create nginx config with SSL
# (Requires domain pointing to the server)
sudo certbot certonly --standalone -d app.yourdomain.com

# Update docker-compose to use nginx with SSL
```

### 3. Setup Regular Backups

```bash
# Create backup script
cat > /opt/backup.sh <<'EOF'
#!/bin/bash
# Backup PostgreSQL database
docker compose exec -T db pg_dump -U zksteam_user zksteam_db | gzip > /tmp/backup_$(date +%Y%m%d_%H%M%S).sql.gz
# Upload to GCS
gsutil cp /tmp/backup_*.sql.gz gs://your-backup-bucket/
# Clean old local backups
rm /tmp/backup_*.sql.gz
EOF

# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/backup.sh") | crontab -
```

## Cost Optimization

### Current Setup Costs (Approximate)
- e2-medium VM: ~$25-35/month
- Static IP: ~$7/month (if not attached)
- Network egress: Variable based on usage
- **Total**: ~$30-40/month

### Cost Reduction Options

```bash
# Switch to smaller machine type
pulumi config set machineType e2-micro  # ~$6/month

# Use Spot VMs (not recommended for production)
# Modify index.ts to set preemptible: true
```

## Cleanup and Destruction

### Temporary Shutdown (Keep Infrastructure)

```bash
# Stop the VM (no compute charges, storage still charged)
gcloud compute instances stop zksteam-app-vm --zone=us-central1-a

# Start when needed
gcloud compute instances start zksteam-app-vm --zone=us-central1-a
```

### Complete Cleanup

```bash
# Destroy all Pulumi-managed resources
cd pulumi
pulumi destroy

# Remove the stack
pulumi stack rm production
```

## Git Repository Management

### Ensure .pnpm-store is Not Tracked

```bash
# Check if server/.pnpm-store/ is tracked
git ls-files | grep "server/.pnpm-store"

# If files are found, remove from tracking
git rm -r --cached server/.pnpm-store/
git commit -m "Remove .pnpm-store from tracking"
git push
```

## Additional Resources

- [GCP Compute Engine Documentation](https://cloud.google.com/compute/docs)
- [Pulumi GCP Provider](https://www.pulumi.com/registry/packages/gcp/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Container-Optimized OS](https://cloud.google.com/container-optimized-os/docs)

## Support and Debugging

For issues with:
- **Pulumi**: Check `pulumi up --logtostderr -v=9` for verbose output
- **Docker**: SSH to VM and check `sudo journalctl -u docker`
- **Application**: Check `/opt/app/ethtokyo2025-sandbox/` logs
- **Network**: Verify firewall rules with `gcloud compute firewall-rules list`