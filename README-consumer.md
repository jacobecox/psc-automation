# Consumer Infrastructure

This module provides automation for setting up consumer infrastructure for Private Service Connect (PSC) using Terraform.

## Prerequisites

Before using this automation, ensure that the service account `central-service-account@admin-project-463522.iam.gserviceaccount.com` has the necessary permissions on the target project:

### Required Permissions

The service account only needs the **Editor** role on the consumer project:
- `roles/editor` - For general resource management (VPC, subnets, firewall rules, NAT, PSC endpoint)

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

5. **Automatically Creates VM**:
   - Creates a VM instance in the consumer VPC after successful deployment
   - Uses e2-micro machine type with Debian 12
   - Places VM in the vm-subnet for internet access

## API Endpoints

### Deploy Consumer Infrastructure

**POST** `/api/consumer/deploy/consumer`

**Request Body:**
```json
{
  "project_id": "consumer-test-project-463821",  // required
  "region": "us-central1",  // required
  "service_attachment_uri": "projects/producer-test-project/regions/us-central1/serviceAttachments/producer-sa",  // required
  "reserved_ip_name": "psc-ip"  // optional, defaults to "psc-ip"
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
  },
  "vm_info": {
    // VM creation details (if successful)
  }
}
```

### Create VM Instance (Standalone)

**POST** `/api/create-vm/deploy/create-vm`

**Request Body:**
```json
{
  "project_id": "consumer-project-463821",  // required
  "region": "us-central1",  // required
  "instance_name": "consumer-vm",  // optional, defaults to "consumer-vm"
  "machine_type": "e2-micro",  // optional, defaults to "e2-micro"
  "os_image": "debian-cloud/debian-12"  // optional, defaults to "debian-cloud/debian-12"
}
```

**VM Configuration Parameters:**

- **instance_name**: Name for the VM instance (e.g., "app-server", "web-server", "consumer-vm")
- **machine_type**: GCP machine type (e.g., "e2-micro", "e2-small", "e2-medium", "n1-standard-1")
- **os_image**: Operating system image (e.g., "debian-cloud/debian-12", "ubuntu-os-cloud/ubuntu-2204-lts", "centos-cloud/centos-7")

**Response:**
```json
{
  "message": "VM created successfully in consumer VPC",
  "project_id": "consumer-project-463821",
  "region": "us-central1",
  "instance_name": "consumer-vm",
  "instance_id": "consumer-vm-123456",
  "zone": "us-central1-a",
  "internal_ip": "10.1.0.10",
  "subnet_name": "vm-subnet",
  "vpc_name": "consumer-vpc",
  "machine_type": "e2-micro",
  "os_image": "debian-cloud/debian-12",
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

### Required Variables

- `project_id` (required) - GCP project ID for consumer
- `region` (required) - GCP region (e.g., "us-central1")
- `service_attachment_uri` (required) - Producer's service attachment URI

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
    "project_id": "consumer-test-project-463821",
    "region": "us-central1",
    "service_attachment_uri": "projects/producer-test-project/regions/us-central1/serviceAttachments/producer-sa"
  }'
```

Test VM creation:

```bash
curl -X POST http://localhost:3000/api/create-vm/deploy/create-vm \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "consumer-project-463821",
    "region": "us-central1",
    "instance_name": "app-server",
    "machine_type": "e2-small",
    "os_image": "ubuntu-os-cloud/ubuntu-2204-lts"
  }'
```

## Usage Examples

### Basic Consumer Deployment
```bash
# Deploy consumer infrastructure with required parameters
curl -X POST http://localhost:3000/api/consumer/deploy/consumer \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "consumer-project-463821",
    "region": "us-central1",
    "service_attachment_uri": "projects/producer-project/regions/us-central1/serviceAttachments/producer-sql-psc"
  }'
```

### Custom VM Configuration
```bash
# Create VM with custom settings
curl -X POST http://localhost:3000/api/create-vm/deploy/create-vm \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "consumer-project-463821",
    "region": "us-central1",
    "instance_name": "web-server",
    "machine_type": "e2-medium",
    "os_image": "ubuntu-os-cloud/ubuntu-2204-lts"
  }'
```

### Production-Ready VM
```bash
# Production-ready VM instance
curl -X POST http://localhost:3000/api/create-vm/deploy/create-vm \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "consumer-project-463821",
    "region": "us-central1",
    "instance_name": "app-server",
    "machine_type": "n1-standard-1",
    "os_image": "debian-cloud/debian-12"
  }'
```

## Available Machine Types

- **e2-micro**: 2 vCPUs, 1 GB RAM (free tier)
- **e2-small**: 2 vCPUs, 2 GB RAM
- **e2-medium**: 2 vCPUs, 4 GB RAM
- **e2-standard-2**: 2 vCPUs, 8 GB RAM
- **e2-standard-4**: 4 vCPUs, 16 GB RAM
- **n1-standard-1**: 1 vCPU, 3.75 GB RAM
- **n1-standard-2**: 2 vCPUs, 7.5 GB RAM
- **n1-standard-4**: 4 vCPUs, 15 GB RAM

## Available OS Images

- **debian-cloud/debian-12**: Debian 12 (latest)
- **ubuntu-os-cloud/ubuntu-2204-lts**: Ubuntu 22.04 LTS
- **ubuntu-os-cloud/ubuntu-2004-lts**: Ubuntu 20.04 LTS
- **centos-cloud/centos-7**: CentOS 7
- **centos-cloud/centos-stream-8**: CentOS Stream 8
- **rhel-cloud/rhel-8**: Red Hat Enterprise Linux 8

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

## State Management

The consumer module uses Terraform workspaces for state isolation:
- Workspace name is derived from the project ID
- Ensures clean state separation between different projects
- Prevents conflicts when managing multiple consumer projects

## Timeouts and Performance

- **Deployment Timeout**: 30 minutes for the entire consumer deployment
- **API Propagation**: 60 seconds wait after API enablement
- **VM Creation**: Automatic VM creation after infrastructure deployment
- **PSC Setup**: Immediate PSC endpoint creation once infrastructure is ready 