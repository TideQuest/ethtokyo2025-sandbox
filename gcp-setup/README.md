# GCP Deployment Guide (Without Pulumi)

This guide provides a pure shell script approach to deploy the zksteam application to Google Cloud Platform using only `gcloud` commands and bash scripts.

## Overview

This deployment method uses:
- **Shell scripts** for automation
- **gcloud CLI** for resource management
- **Container-Optimized OS** for Docker support
- **Startup scripts** for automatic configuration

## Prerequisites

### Required Tools
```bash
# Check if gcloud is installed
gcloud version

# If not installed, download from:
# https://cloud.google.com/sdk/docs/install
```

### GCP Setup
```bash
# Login to GCP
gcloud auth login

# Set your project ID
export GCP_PROJECT_ID="your-project-id"

# Set default project
gcloud config set project $GCP_PROJECT_ID

# Enable billing (required for creating resources)
# Visit: https://console.cloud.google.com/billing
```

## Quick Start

### 1. Clone this repository
```bash
git clone https://github.com/TideQuest/ethtokyo2025-sandbox.git
cd ethtokyo2025-sandbox/gcp-setup
```

### 2. Make scripts executable
```bash
chmod +x setup.sh cleanup.sh
```

### 3. Set environment variables
```bash
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"        # Optional, defaults to us-central1
export GCP_ZONE="us-central1-a"        # Optional, defaults to us-central1-a
export INSTANCE_NAME="zksteam-app-vm"  # Optional, custom instance name
export MACHINE_TYPE="e2-medium"        # Optional, defaults to e2-medium
```

### 4. Run the setup script
```bash
./setup.sh
```

The script will:
1. Enable required GCP APIs
2. Create a service account
3. Set up firewall rules
4. Reserve a static IP
5. Create and configure the VM
6. Deploy the application automatically

## Manual Step-by-Step Deployment

If you prefer to run commands manually:

### Step 1: Enable Required APIs
```bash
gcloud services enable compute.googleapis.com
gcloud services enable iam.googleapis.com
gcloud services enable logging.googleapis.com
gcloud services enable dns.googleapis.com
```

### Step 2: Create Service Account
```bash
# Create service account
gcloud iam service-accounts create vm-service-account \
    --display-name="VM Service Account"

# Grant logging permissions
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
    --member="serviceAccount:vm-service-account@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/logging.logWriter"
```

### Step 3: Create Firewall Rules
```bash
# Allow HTTP
gcloud compute firewall-rules create allow-http \
    --allow tcp:80 \
    --source-ranges 0.0.0.0/0 \
    --target-tags web

# Allow HTTPS
gcloud compute firewall-rules create allow-https \
    --allow tcp:443 \
    --source-ranges 0.0.0.0/0 \
    --target-tags web

# Allow application ports
gcloud compute firewall-rules create allow-app-ports \
    --allow tcp:3000,tcp:5173,tcp:8080 \
    --source-ranges 0.0.0.0/0 \
    --target-tags web

# Allow PostgreSQL (restrict in production!)
gcloud compute firewall-rules create allow-postgres \
    --allow tcp:5432 \
    --source-ranges 0.0.0.0/0 \
    --target-tags db

# Allow Ollama
gcloud compute firewall-rules create allow-ollama \
    --allow tcp:11434 \
    --source-ranges 0.0.0.0/0 \
    --target-tags ai
```

### Step 4: Reserve Static IP
```bash
gcloud compute addresses create tidequest-static-ip \
    --region=us-central1

# Get the IP address
STATIC_IP=$(gcloud compute addresses describe tidequest-static-ip \
    --region=us-central1 --format="value(address)")
echo "Static IP: $STATIC_IP"
```

### Step 5: Create VM Instance
```bash
# Use the startup script
gcloud compute instances create zksteam-app-vm \
    --zone=us-central1-a \
    --machine-type=e2-medium \
    --network-interface=address=$STATIC_IP,network-tier=PREMIUM,subnet=default \
    --boot-disk-size=50GB \
    --boot-disk-type=pd-standard \
    --image-family=cos-stable \
    --image-project=cos-cloud \
    --maintenance-policy=MIGRATE \
    --service-account=vm-service-account@$GCP_PROJECT_ID.iam.gserviceaccount.com \
    --scopes=https://www.googleapis.com/auth/cloud-platform \
    --tags=web,db,ai \
    --metadata-from-file startup-script=startup-script.sh \
    --metadata enable-oslogin=TRUE
```

## Post-Deployment

### SSH into the VM
```bash
gcloud compute ssh zksteam-app-vm --zone=us-central1-a
```

### Check deployment status
```bash
# View startup script logs
sudo journalctl -u google-startup-scripts.service -f

# Or check the log file
sudo tail -f /var/log/startup-script.log

# Check Docker containers
sudo docker ps

# View Docker Compose logs
cd /opt/app/ethtokyo2025-sandbox
sudo docker compose logs -f
```

### Update environment variables
```bash
# Edit the .env file
sudo nano /opt/app/ethtokyo2025-sandbox/.env

# Restart services after changes
sudo docker compose restart
```

## Application Management

### Update application
```bash
# SSH into the VM
gcloud compute ssh zksteam-app-vm --zone=us-central1-a

# Run update script
sudo /usr/local/bin/update-app.sh
```

### Manual update process
```bash
cd /opt/app/ethtokyo2025-sandbox
sudo git pull origin main
sudo docker compose down
sudo docker compose up -d --build
```

### Monitor services
```bash
# Check service health
sudo /usr/local/bin/check-services.sh

# View monitoring logs
sudo tail -f /var/log/service-monitor.log
```

## Cost Management

### Estimated Monthly Costs
- **e2-medium VM**: ~$25-35/month
- **50GB Standard disk**: ~$2/month
- **Static IP**: ~$7/month (when not attached)
- **Network egress**: Variable based on usage
- **Total**: ~$35-45/month

### Cost Optimization

#### Use smaller machine type
```bash
# Recreate with e2-micro (for testing only)
export MACHINE_TYPE="e2-micro"
./setup.sh
```

#### Stop VM when not in use
```bash
# Stop the VM (no compute charges, disk still charged)
gcloud compute instances stop zksteam-app-vm --zone=us-central1-a

# Start when needed
gcloud compute instances start zksteam-app-vm --zone=us-central1-a
```

#### Schedule automatic start/stop
```bash
# Create instance schedule (requires Cloud Scheduler API)
gcloud compute resource-policies create instance-schedule weekday-only \
    --region=us-central1 \
    --vm-start-schedule="0 9 * * MON-FRI" \
    --vm-stop-schedule="0 18 * * MON-FRI" \
    --timezone="America/Los_Angeles"

# Attach to instance
gcloud compute instances add-resource-policies zksteam-app-vm \
    --resource-policies=weekday-only \
    --zone=us-central1-a
```

## Security Hardening

### Restrict firewall rules
```bash
# Get your current IP
MY_IP=$(curl -s ifconfig.me)

# Restrict PostgreSQL access
gcloud compute firewall-rules update allow-postgres \
    --source-ranges="$MY_IP/32"

# Restrict Ollama access
gcloud compute firewall-rules update allow-ollama \
    --source-ranges="$MY_IP/32"
```

### Enable HTTPS with Let's Encrypt
```bash
# SSH into the VM
gcloud compute ssh zksteam-app-vm --zone=us-central1-a

# Install certbot
sudo apt-get update
sudo apt-get install -y certbot

# Get certificate (replace with your domain)
sudo certbot certonly --standalone \
    -d app.yourdomain.com \
    --agree-tos \
    --email your-email@example.com

# Update nginx configuration to use SSL
# (Requires nginx service in docker-compose)
```

### Setup Cloud Armor (DDoS protection)
```bash
# Create security policy
gcloud compute security-policies create zksteam-security-policy \
    --description="Security policy for zksteam app"

# Add rate limiting rule
gcloud compute security-policies rules create 1000 \
    --security-policy=zksteam-security-policy \
    --expression="true" \
    --action="rate-based-ban" \
    --rate-limit-threshold-count=100 \
    --rate-limit-threshold-interval-sec=60 \
    --ban-duration-sec=600
```

## Backup and Recovery

### Backup database
```bash
# SSH into the VM
gcloud compute ssh zksteam-app-vm --zone=us-central1-a

# Create backup
sudo docker compose exec -T db pg_dump -U zksteam_user zksteam_db | \
    gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Upload to Cloud Storage (requires bucket)
gsutil cp backup_*.sql.gz gs://your-backup-bucket/
```

### Restore database
```bash
# Download backup
gsutil cp gs://your-backup-bucket/backup_20240101_120000.sql.gz .

# Restore
gunzip -c backup_20240101_120000.sql.gz | \
    sudo docker compose exec -T db psql -U zksteam_user zksteam_db
```

### Create VM snapshot
```bash
# Stop the VM first
gcloud compute instances stop zksteam-app-vm --zone=us-central1-a

# Create snapshot
gcloud compute disks snapshot zksteam-app-vm \
    --snapshot-names=zksteam-snapshot-$(date +%Y%m%d) \
    --zone=us-central1-a

# Start the VM
gcloud compute instances start zksteam-app-vm --zone=us-central1-a
```

## Monitoring

### View VM metrics
```bash
# CPU utilization
gcloud compute instances describe zksteam-app-vm \
    --zone=us-central1-a \
    --format="get(cpuPlatform)"

# View logs
gcloud logging read "resource.type=gce_instance AND \
    resource.labels.instance_id=$(gcloud compute instances describe zksteam-app-vm \
    --zone=us-central1-a --format='value(id)')" \
    --limit=50
```

### Setup alerts
```bash
# Create notification channel
gcloud alpha monitoring channels create \
    --display-name="Email Notifications" \
    --type=email \
    --channel-labels=email_address=your-email@example.com

# Create CPU alert policy
gcloud alpha monitoring policies create \
    --display-name="High CPU Usage" \
    --condition="resource.type=\"gce_instance\" AND \
                metric.type=\"compute.googleapis.com/instance/cpu/utilization\" AND \
                threshold_value > 0.8" \
    --notification-channels=<CHANNEL_ID>
```

## Troubleshooting

### Common Issues

#### Docker containers not starting
```bash
# Check Docker status
sudo systemctl status docker

# Restart Docker
sudo systemctl restart docker

# Check compose logs
cd /opt/app/ethtokyo2025-sandbox
sudo docker compose logs
```

#### Can't connect to application
```bash
# Check firewall rules
gcloud compute firewall-rules list

# Check instance network tags
gcloud compute instances describe zksteam-app-vm \
    --zone=us-central1-a \
    --format="get(tags.items[])"

# Verify services are running
sudo docker ps
```

#### Disk space issues
```bash
# Check disk usage
df -h

# Clean Docker resources
sudo docker system prune -a

# Remove old logs
sudo journalctl --vacuum-time=7d
```

## Cleanup

To remove all resources:

```bash
# Run the cleanup script
./cleanup.sh
```

Or manually:

```bash
# Delete VM instance
gcloud compute instances delete zksteam-app-vm \
    --zone=us-central1-a --quiet

# Release static IP
gcloud compute addresses delete tidequest-static-ip \
    --region=us-central1 --quiet

# Delete firewall rules
gcloud compute firewall-rules delete allow-http --quiet
gcloud compute firewall-rules delete allow-https --quiet
gcloud compute firewall-rules delete allow-app-ports --quiet
gcloud compute firewall-rules delete allow-postgres --quiet
gcloud compute firewall-rules delete allow-ollama --quiet

# Delete service account
gcloud iam service-accounts delete \
    vm-service-account@$GCP_PROJECT_ID.iam.gserviceaccount.com --quiet
```

## Support

For issues or questions:
1. Check the [GitHub repository](https://github.com/TideQuest/ethtokyo2025-sandbox)
2. Review VM logs: `sudo tail -f /var/log/startup-script.log`
3. Check Docker logs: `sudo docker compose logs`
4. Verify GCP quotas and billing status

## License

This deployment guide is part of the zksteam project. See the main repository for license information.