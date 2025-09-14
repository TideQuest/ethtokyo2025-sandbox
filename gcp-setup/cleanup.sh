#!/bin/bash
set -e

# =============================================================================
# GCP Resources Cleanup Script
# This script removes all resources created by the setup script
# =============================================================================

# Configuration Variables
PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-us-central1}"
ZONE="${GCP_ZONE:-us-central1-a}"
INSTANCE_NAME="${INSTANCE_NAME:-zksteam-app-vm}"
SERVICE_ACCOUNT_NAME="vm-service-account"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

confirm_deletion() {
    print_warning "This will delete all GCP resources created for the zksteam application."
    echo "Resources to be deleted:"
    echo "  - VM Instance: $INSTANCE_NAME"
    echo "  - Static IP: tidequest-static-ip"
    echo "  - Firewall rules: allow-http, allow-https, allow-app-ports, allow-postgres, allow-ollama"
    echo "  - Service Account: $SERVICE_ACCOUNT_NAME"
    echo ""
    read -p "Are you sure you want to continue? Type 'yes' to confirm: " -r response
    if [[ "$response" != "yes" ]]; then
        echo "Cleanup cancelled."
        exit 0
    fi
}

delete_vm_instance() {
    print_header "Deleting VM Instance"

    if gcloud compute instances describe "$INSTANCE_NAME" --zone="$ZONE" &>/dev/null; then
        gcloud compute instances delete "$INSTANCE_NAME" \
            --zone="$ZONE" \
            --quiet
        print_success "VM instance deleted"
    else
        print_warning "VM instance not found"
    fi
}

release_static_ip() {
    print_header "Releasing Static IP"

    if gcloud compute addresses describe tidequest-static-ip --region="$REGION" &>/dev/null; then
        gcloud compute addresses delete tidequest-static-ip \
            --region="$REGION" \
            --quiet
        print_success "Static IP released"
    else
        print_warning "Static IP not found"
    fi
}

delete_firewall_rules() {
    print_header "Deleting Firewall Rules"

    local rules=("allow-http" "allow-https" "allow-app-ports" "allow-postgres" "allow-ollama")

    for rule in "${rules[@]}"; do
        if gcloud compute firewall-rules describe "$rule" &>/dev/null; then
            gcloud compute firewall-rules delete "$rule" --quiet
            print_success "Deleted firewall rule: $rule"
        else
            print_warning "Firewall rule not found: $rule"
        fi
    done
}

delete_service_account() {
    print_header "Deleting Service Account"

    local sa_email="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

    if gcloud iam service-accounts describe "$sa_email" &>/dev/null; then
        # Remove IAM policy binding
        gcloud projects remove-iam-policy-binding "$PROJECT_ID" \
            --member="serviceAccount:$sa_email" \
            --role="roles/logging.logWriter" \
            --quiet || true

        # Delete service account
        gcloud iam service-accounts delete "$sa_email" --quiet
        print_success "Service account deleted"
    else
        print_warning "Service account not found"
    fi
}

delete_dns_records() {
    print_header "Checking for DNS Records"

    # Check if DNS zone exists
    if gcloud dns managed-zones describe tidequest-zone &>/dev/null; then
        print_warning "DNS zone 'tidequest-zone' found"
        read -p "Do you want to delete the DNS zone? (y/n): " -r response
        if [[ "$response" == "y" ]]; then
            # Delete all record sets except SOA and NS
            gcloud dns record-sets list --zone=tidequest-zone --format="value(name,type)" | \
            while read -r name type; do
                if [[ "$type" != "SOA" && "$type" != "NS" ]]; then
                    gcloud dns record-sets delete "$name" \
                        --zone=tidequest-zone \
                        --type="$type" \
                        --quiet || true
                fi
            done

            # Delete the zone
            gcloud dns managed-zones delete tidequest-zone --quiet
            print_success "DNS zone deleted"
        fi
    else
        print_warning "DNS zone not found"
    fi
}

print_summary() {
    print_header "Cleanup Summary"

    echo "The following resources have been cleaned up:"
    echo "  ✅ VM Instance"
    echo "  ✅ Static IP Address"
    echo "  ✅ Firewall Rules"
    echo "  ✅ Service Account"
    echo "  ✅ DNS Records (if existed)"
    echo ""
    echo "Your GCP project has been cleaned of zksteam application resources."
}

# Main execution
main() {
    print_header "GCP Resources Cleanup"

    if [ -z "$PROJECT_ID" ]; then
        print_error "GCP_PROJECT_ID environment variable is not set."
        echo "Please run: export GCP_PROJECT_ID=your-project-id"
        exit 1
    fi

    gcloud config set project "$PROJECT_ID"

    confirm_deletion
    delete_vm_instance
    release_static_ip
    delete_firewall_rules
    delete_service_account
    delete_dns_records
    print_summary

    print_header "Cleanup Complete!"
}

# Run main function
main "$@"