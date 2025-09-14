import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

// Configuration
const config = new pulumi.Config();
const projectId = config.require("gcp:project");
const region = config.get("region") || "us-central1";
const zone = config.get("zone") || "us-central1-a";
const domain = config.get("domain") || "tidequest.com";
const subdomain = config.get("subdomain") || "app";

// Create a static external IP address
const staticIp = new gcp.compute.Address("tidequest-static-ip", {
    name: "tidequest-static-ip",
    region: region,
    addressType: "EXTERNAL",
});

// Create a service account for the VM
const serviceAccount = new gcp.serviceaccount.Account("vm-service-account", {
    accountId: "vm-service-account",
    displayName: "VM Service Account",
});

// Grant necessary permissions to the service account
new gcp.projects.IAMMember("vm-service-account-logging", {
    project: projectId,
    role: "roles/logging.logWriter",
    member: pulumi.interpolate`serviceAccount:${serviceAccount.email}`,
});

// Create firewall rules
const firewallHttp = new gcp.compute.Firewall("allow-http", {
    network: "default",
    allows: [{
        protocol: "tcp",
        ports: ["80"],
    }],
    sourceRanges: ["0.0.0.0/0"],
    targetTags: ["web"],
});

const firewallHttps = new gcp.compute.Firewall("allow-https", {
    network: "default",
    allows: [{
        protocol: "tcp",
        ports: ["443"],
    }],
    sourceRanges: ["0.0.0.0/0"],
    targetTags: ["web"],
});

// Frontend and backend ports (for development access - restrict in production)
const firewallApp = new gcp.compute.Firewall("allow-app-ports", {
    network: "default",
    allows: [{
        protocol: "tcp",
        ports: ["3000", "5173", "8080"],
    }],
    sourceRanges: ["0.0.0.0/0"], // Restrict this in production
    targetTags: ["web"],
});

// Postgres port (restrict access in production)
const firewallDb = new gcp.compute.Firewall("allow-postgres", {
    network: "default",
    allows: [{
        protocol: "tcp",
        ports: ["5432"],
    }],
    sourceRanges: ["0.0.0.0/0"], // IMPORTANT: Restrict this to specific IPs in production
    targetTags: ["db"],
});

// Ollama port (restrict access in production)
const firewallAi = new gcp.compute.Firewall("allow-ollama", {
    network: "default",
    allows: [{
        protocol: "tcp",
        ports: ["11434"],
    }],
    sourceRanges: ["0.0.0.0/0"], // IMPORTANT: Restrict this to specific IPs in production
    targetTags: ["ai"],
});

// Create startup script for the VM
const startupScript = pulumi.interpolate`#!/bin/bash
set -e

# Update system
apt-get update

# Install Docker and Docker Compose if not present (Container-Optimized OS has Docker pre-installed)
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    apt-get install -y docker-compose-plugin
fi

# Install git
apt-get install -y git

# Create working directory
mkdir -p /opt/app
cd /opt/app

# Clone the repository
if [ ! -d "ethtokyo2025-sandbox" ]; then
    git clone https://github.com/TideQuest/ethtokyo2025-sandbox.git
fi

cd ethtokyo2025-sandbox

# Create .env file with defaults if not exists
if [ ! -f .env ]; then
    cat > .env <<EOL
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
VITE_BACKEND_URL=http://${staticIp.address}:3000

# External URL (update with your domain)
EXTERNAL_URL=http://${subdomain}.${domain}
EOL
fi

# Pull latest changes
git pull origin main || true

# Start services with Docker Compose
docker compose up -d

# Wait for Ollama to be healthy
echo "Waiting for Ollama to be ready..."
sleep 30

# Pull Ollama model
docker compose run --rm ollama-init || true

# Check service status
docker compose ps

# Setup log rotation
cat > /etc/logrotate.d/docker-containers <<EOL
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    missingok
    delaycompress
    copytruncate
}
EOL

echo "Deployment completed successfully!"
`;

// Create the Compute Engine instance
const vmInstance = new gcp.compute.Instance("app-vm", {
    name: "zksteam-app-vm",
    machineType: "e2-medium", // 2 vCPUs, 4GB RAM
    zone: zone,

    // Use Container-Optimized OS for better Docker support
    bootDisk: {
        initializeParams: {
            image: "cos-cloud/cos-stable",
            size: 50, // 50GB disk
            type: "pd-standard",
        },
    },

    // Network configuration
    networkInterfaces: [{
        network: "default",
        accessConfigs: [{
            natIp: staticIp.address,
        }],
    }],

    // Tags for firewall rules
    tags: ["web", "db", "ai"],

    // Service account
    serviceAccounts: [{
        email: serviceAccount.email,
        scopes: ["cloud-platform"],
    }],

    // Metadata including startup script
    metadata: {
        "startup-script": startupScript,
        "enable-oslogin": "TRUE",
    },

    // Not using preemptible VM for stability
    scheduling: {
        preemptible: false,
        automaticRestart: true,
        onHostMaintenance: "MIGRATE",
    },

    // Labels for organization
    labels: {
        environment: "production",
        app: "zksteam",
    },
});

// Cloud DNS Setup (optional - configure if you own the domain)
const dnsZone = new gcp.dns.ManagedZone("tidequest-zone", {
    name: "tidequest-zone",
    dnsName: `${domain}.`,
    description: "DNS zone for TideQuest application",
}, {
    // Only create if you want to manage DNS through GCP
    protect: true
});

// Create A record for the subdomain
const dnsRecord = new gcp.dns.RecordSet("app-record", {
    name: pulumi.interpolate`${subdomain}.${domain}.`,
    managedZone: dnsZone.name,
    type: "A",
    ttl: 300,
    rrdatas: [staticIp.address],
});

// Export important values
export const instanceName = vmInstance.name;
export const instanceZone = vmInstance.zone;
export const externalIp = staticIp.address;
export const sshCommand = pulumi.interpolate`gcloud compute ssh ${vmInstance.name} --zone=${vmInstance.zone}`;
export const appUrl = pulumi.interpolate`http://${staticIp.address}:8080`;
export const frontendUrl = pulumi.interpolate`http://${staticIp.address}:5173`;
export const backendUrl = pulumi.interpolate`http://${staticIp.address}:3000`;
export const domainUrl = pulumi.interpolate`http://${subdomain}.${domain}`;

// Instructions for post-deployment
export const postDeploymentInstructions = `
After deployment:
1. SSH into the VM: gcloud compute ssh ${vmInstance.name} --zone=${vmInstance.zone}
2. Check Docker containers: sudo docker ps
3. View logs: sudo docker compose logs -f
4. Update .env file: sudo nano /opt/app/ethtokyo2025-sandbox/.env
5. Restart services: cd /opt/app/ethtokyo2025-sandbox && sudo docker compose restart

To update the application:
1. SSH into the VM
2. cd /opt/app/ethtokyo2025-sandbox
3. sudo git pull
4. sudo docker compose down
5. sudo docker compose up -d --build

For HTTPS setup with Let's Encrypt:
1. Point your domain to ${staticIp.address}
2. SSH into the VM and install certbot
3. Configure nginx with SSL certificates
`;