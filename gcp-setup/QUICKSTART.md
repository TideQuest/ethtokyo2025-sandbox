# Quick Start Guide - Deploy in 5 Minutes

Deploy zksteam to GCP with just a few commands!

## Prerequisites
- GCP account with billing enabled
- `gcloud` CLI installed ([Install Guide](https://cloud.google.com/sdk/docs/install))

## 1. Setup (One-time)
```bash
# Login to GCP
gcloud auth login

# Set your project
export GCP_PROJECT_ID="your-project-id"
gcloud config set project $GCP_PROJECT_ID
```

## 2. Deploy
```bash
# Clone the repo
git clone https://github.com/TideQuest/ethtokyo2025-sandbox.git
cd ethtokyo2025-sandbox/gcp-setup

# Make script executable
chmod +x setup.sh

# Run setup (takes ~5-10 minutes)
./setup.sh
```

## 3. Access Your Application

After setup completes, you'll see:
```
External IP: XX.XXX.XXX.XX

Application URLs:
  Frontend: http://XX.XXX.XXX.XX:5173
  Backend API: http://XX.XXX.XXX.XX:3000
```

Open the Frontend URL in your browser!

## 4. SSH Access (Optional)
```bash
# Connect to your VM
gcloud compute ssh zksteam-app-vm --zone=us-central1-a

# Check Docker containers
sudo docker ps

# View logs
cd /opt/app/ethtokyo2025-sandbox
sudo docker compose logs -f
```

## 5. Stop/Start VM (Save Money)
```bash
# Stop when not using (saves ~$25/month)
gcloud compute instances stop zksteam-app-vm --zone=us-central1-a

# Start when needed
gcloud compute instances start zksteam-app-vm --zone=us-central1-a
```

## 6. Cleanup (Remove Everything)
```bash
# Remove all resources
./cleanup.sh
```

## Costs
- **Running**: ~$1.20/day ($35/month)
- **Stopped**: ~$0.07/day ($2/month) - only disk storage

## Troubleshooting

### Can't access the application?
1. Wait 2-3 minutes after deployment for services to start
2. Check firewall: `gcloud compute firewall-rules list`
3. SSH and check Docker: `sudo docker ps`

### Need to update .env?
```bash
gcloud compute ssh zksteam-app-vm --zone=us-central1-a
sudo nano /opt/app/ethtokyo2025-sandbox/.env
sudo docker compose restart
```

### Application not starting?
```bash
# SSH into VM
gcloud compute ssh zksteam-app-vm --zone=us-central1-a

# Check startup logs
sudo tail -f /var/log/startup-script.log

# Restart services
cd /opt/app/ethtokyo2025-sandbox
sudo docker compose down
sudo docker compose up -d
```

## Next Steps
- [Full Documentation](README.md)
- [Security Hardening](README.md#security-hardening)
- [Setup HTTPS](README.md#enable-https-with-lets-encrypt)
- [Backup Strategy](README.md#backup-and-recovery)

---

**That's it!** Your application is now running on GCP. 🚀