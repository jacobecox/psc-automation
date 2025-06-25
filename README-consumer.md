# Consumer Infrastructure

This module provides automation for setting up consumer infrastructure for Private Service Connect (PSC) using Terraform.

## Prerequisites

Before using this automation, ensure that the service account `central-service-account@admin-project-463522.iam.gserviceaccount.com` has the necessary permissions on the target project:

### Required Permissions

The service account needs the following roles on the target project:
- `roles/editor` - For general resource management
- `roles/serviceusage.serviceUsageAdmin` - For API enablement
- `roles/resourcemanager.projectIamAdmin` - For IAM management

### Granting Permissions

You can grant the required permissions using one of these methods:

**Option 1: Use the provided script**
```bash
chmod +x grant-permissions.sh
./grant-permissions.sh your-project-id
```

**Option 2: Manual gcloud command**
```bash
gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:central-service-account@admin-project-463522.iam.gserviceaccount.com" \
  --role="roles/editor"
```

**Option 3: Grant all required roles**
```bash
gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:central-service-account@admin-project-463522.iam.gserviceaccount.com" \
  --role="roles/editor"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:central-service-account@admin-project-463522.iam.gserviceaccount.com" \
  --role="roles/serviceusage.serviceUsageAdmin"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:central-service-account@admin-project-463522.iam.gserviceaccount.com" \
  --role="roles/resourcemanager.projectIamAdmin"
```

### Error Handling

If you encounter permission errors during deployment, the system will provide clear guidance on how to resolve them. The error messages will include the exact commands needed to grant the necessary permissions.

## Features

The consumer route automatically:

1. **Enables Required APIs**:
   - Cloud Resource Manager API (`cloudresourcemanager.googleapis.com`)
   - Compute Engine API (`compute.googleapis.com`)

2. **Creates Network Infrastructure**:
   - VPC named "consumer-vpc"
   - VM subnet named "vm-subnet" with CIDR `10.1.0.0/24`
   - PSC subnet named "psc-subnet" with CIDR `10.2.0.0/24`
   - Default firewall rules for internal communication and SSH access
   - Egress firewall rule for PostgreSQL connections (port 5432)

3. **Sets Up Cloud NAT**:
   - Cloud Router for NAT functionality
   - Cloud NAT configured to only expose NAT to the vm-subnet (not psc-subnet)
   - Reserved static IP for the PSC endpoint

4. **Creates Private Service Connect Endpoint**:
   - Connects to the producer's service attachment
   - Enables secure communication between consumer and producer

## API Endpoints

### Deploy Consumer Infrastructure

**POST** `/api/consumer/deploy/consumer`

**Request Body:**
```json
{
  "consumer_project_id": "consumer-test-project-463821",  // required
  "region": "us-central1",  // optional, defaults to us-central1
  "service_attachment_uri": "projects/producer-test-project/regions/us-central1/serviceAttachments/producer-sa"  // required
}
```

**Response:**
```json
{
  "message": "Consumer infrastructure deployed successfully",
  "project_id": "consumer-test-project-463821",
  "region": "us-central1",
  "vpc_name": "consumer-vpc",
  "vm_subnet_name": "vm-subnet",
  "psc_subnet_name": "psc-subnet",
  "vpc_self_link": "https://www.googleapis.com/compute/v1/projects/...",
  "vm_subnet_self_link": "https://www.googleapis.com/compute/v1/projects/...",
  "psc_subnet_self_link": "https://www.googleapis.com/compute/v1/projects/...",
  "psc_ip_address": "10.2.0.2",
  "psc_endpoint_name": "psc-endpoint",
  "service_attachment_uri": "projects/producer-test-project/regions/us-central1/serviceAttachments/producer-sa",
  "terraform_output": {
    // Full Terraform output object
  }
}
```

## Terraform Configuration

The Terraform configuration is located in `terraform/consumer/` and includes:

- **api-enablement.tf**: API enablement configuration
- **infrastructure.tf**: Main infrastructure configuration
- **variables.tf**: Input variables definition

### Resources Created

1. **Google Project Services**:
   - `google_project_service.cloud_resource_manager`
   - `google_project_service.compute_engine`

2. **Network Resources**:
   - `google_compute_network.consumer_vpc`
   - `google_compute_subnetwork.vm_subnet`
   - `google_compute_subnetwork.psc_subnet`
   - `google_compute_firewall.default_allow_internal`
   - `google_compute_firewall.default_allow_ssh`
   - `google_compute_firewall.allow_postgres_egress`

3. **NAT and Routing**:
   - `google_compute_router.nat_router`
   - `google_compute_router_nat.nat`

4. **Private Service Connect**:
   - `google_compute_address.psc_ip`
   - `google_compute_forwarding_rule.psc_endpoint`

## Testing

Test the consumer deployment:

```bash
curl -X POST http://localhost:3000/api/consumer/deploy/consumer \
  -H "Content-Type: application/json" \
  -d '{
    "consumer_project_id": "consumer-test-project-463821",
    "region": "us-central1",
    "service_attachment_uri": "projects/producer-test-project/regions/us-central1/serviceAttachments/producer-sa"
  }'
```

## Error Handling

The API provides detailed error messages for:
- Invalid project ID, region, or service attachment URI
- Permission denied errors with clear resolution steps
- Terraform execution failures
- Missing or malformed requests
- Infrastructure deployment issues

## Network Architecture

The consumer infrastructure creates a dual-subnet architecture:

1. **VM Subnet** (`10.1.0.0/24`):
   - For VM instances that need internet access
   - Connected to Cloud NAT for outbound internet access
   - Can access the producer's SQL instance via PSC

2. **PSC Subnet** (`10.2.0.0/24`):
   - For the PSC endpoint only
   - No NAT access (isolated from internet)
   - Direct connection to the producer's service attachment

This architecture provides security by isolating the PSC endpoint while allowing VMs to access both the internet and the producer's services. 