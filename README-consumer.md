# Consumer Infrastructure

This module provides automation for setting up consumer infrastructure for Private Service Connect (PSC) using Terraform.

## Prerequisites

Before using this automation, ensure that the service account has the necessary permissions on the target project:

### Required Permissions

The service account needs these roles on the consumer project:
- `roles/editor` - For general resource management (VPC, subnets, firewall rules, NAT, PSC endpoint)
- `roles/serviceusage.serviceUsageAdmin` - For enabling required APIs (Cloud Resource Manager, Compute Engine)

### Granting Permissions

You can grant the required permissions using these gcloud commands:

```bash
# Basic permissions for resource management
gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/editor"

# API enablement permissions
gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/serviceusage.serviceUsageAdmin"
```

### Error Handling

If you encounter permission errors during deployment, the system will provide clear guidance on how to resolve them. The error messages will include the exact commands needed to grant the necessary permissions.

## Features

The consumer route automatically:

1. **Enables Required APIs**:
   - Cloud Resource Manager API (`cloudresourcemanager.googleapis.com`)
   - Compute Engine API (`compute.googleapis.com`)

2. **Creates Network Infrastructure**:
   - VPC with configurable name (default: "consumer-vpc")
   - VM subnet with configurable name (default: "vm-subnet") and CIDR (default: `10.1.0.0/24`)
   - PSC subnet with configurable name (default: "psc-subnet") and CIDR (default: `10.2.0.0/24`)
   - Default firewall rules for internal communication and SSH access
   - Egress firewall rule for PostgreSQL connections (port 5432)
   - Outputs VPC and subnet self_links for use by dependent modules

3. **Sets Up Cloud NAT**:
   - Cloud Router for NAT functionality
   - Cloud NAT configured to only expose NAT to the vm-subnet (not psc-subnet)
   - Reserved static IP for the PSC endpoint

4. **Creates Private Service Connect Endpoint**:
   - Connects to the producer's service attachment
   - Enables secure communication between consumer and producer

5. **Optionally Creates VM**:
   - Creates a VM instance in the consumer VPC if VM parameters are provided
   - Uses the VPC and subnet self_links from the infrastructure module for proper dependency management
   - Uses configurable machine type and OS image

## API Endpoints

### Deploy Consumer Infrastructure

**POST** `/api/consumer/deploy/consumer`

**Request Body:**
```json
{
  "project_id": "consumer-project-123",  // required
  "region": "us-central1",  // required
  "service_attachment_uri": "projects/producer-project/regions/us-central1/serviceAttachments/producer-sql-psc",  // required
  "consumer_vpc_name": "consumer-vpc",  // optional, defaults to "consumer-vpc"
  "vm_subnet_name": "vm-subnet",  // optional, defaults to "vm-subnet"
  "psc_subnet_name": "psc-subnet",  // optional, defaults to "psc-subnet"
  "vm_subnet_cidr_range": "10.1.0.0/24",  // optional, defaults to "10.1.0.0/24"
  "psc_subnet_cidr_range": "10.2.0.0/24",  // optional, defaults to "10.2.0.0/24"
  "internal_firewall_source_ranges": ["10.0.0.0/8"],  // optional, defaults to ["10.0.0.0/8"]
  "postgres_egress_destination_ranges": ["10.0.0.0/8"],  // optional, defaults to ["10.0.0.0/8"]
  "psc_endpoint_name": "psc-endpoint",  // optional, defaults to "psc-endpoint"
  "instance_name": "consumer-vm",  // optional, creates VM if provided
  "machine_type": "e2-micro",  // optional, defaults to "e2-micro"
  "os_image": "debian-cloud/debian-12"  // optional, defaults to "debian-cloud/debian-12"
}
```

**Response:**
```json
{
  "message": "Consumer infrastructure and VM deployed successfully",
  "project_id": "consumer-project-123",
  "region": "us-central1",
  "infrastructure": {
    "vpc_name": "consumer-vpc",
    "vm_subnet_name": "vm-subnet",
    "psc_subnet_name": "psc-subnet",
    "vpc_self_link": "https://www.googleapis.com/compute/v1/projects/...",
    "vm_subnet_self_link": "https://www.googleapis.com/compute/v1/projects/...",
    "psc_subnet_self_link": "https://www.googleapis.com/compute/v1/projects/...",
    "psc_ip_address": "10.2.0.2",
    "psc_endpoint_name": "psc-endpoint",
    "service_attachment_uri": "projects/producer-project/regions/us-central1/serviceAttachments/producer-sql-psc"
  },
  "vm": {
    "instance_name": "consumer-vm",
    "instance_id": "consumer-vm-123456",
    "zone": "us-central1-a",
    "internal_ip": "10.1.0.10",
    "machine_type": "e2-micro",
    "os_image": "debian-cloud/debian-12"
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

### Optional Variables

- `consumer_vpc_name` (default: "consumer-vpc") - Name of the consumer VPC
- `vm_subnet_name` (default: "vm-subnet") - Name of the VM subnet
- `psc_subnet_name` (default: "psc-subnet") - Name of the PSC subnet
- `vm_subnet_cidr_range` (default: "10.1.0.0/24") - CIDR range for VM subnet
- `psc_subnet_cidr_range` (default: "10.2.0.0/24") - CIDR range for PSC subnet
- `internal_firewall_source_ranges` (default: ["10.0.0.0/8"]) - Source ranges for internal firewall
- `postgres_egress_destination_ranges` (default: ["10.0.0.0/8"]) - Destination ranges for PostgreSQL egress
- `psc_endpoint_name` (default: "psc-endpoint") - Name of the PSC endpoint

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
    "project_id": "consumer-project-123",
    "region": "us-central1",
    "service_attachment_uri": "projects/producer-project/regions/us-central1/serviceAttachments/producer-sql-psc"
  }'
```

Test with custom configuration:

```bash
curl -X POST http://localhost:3000/api/consumer/deploy/consumer \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "consumer-project-123",
    "region": "us-central1",
    "service_attachment_uri": "projects/producer-project/regions/us-central1/serviceAttachments/producer-sql-psc",
    "consumer_vpc_name": "my-custom-vpc",
    "vm_subnet_name": "my-vm-subnet",
    "psc_subnet_name": "my-psc-subnet",
    "instance_name": "my-app-vm",
    "machine_type": "e2-small"
  }'
```

## Error Handling

The consumer route includes comprehensive error handling:

- **Validation errors** for missing required fields
- **Terraform execution errors** with detailed logging
- **API enablement errors** with retry logic
- **VM creation errors** that don't fail the entire deployment

## Architecture

The consumer infrastructure creates a secure network environment for connecting to producer services:

1. **VPC with dual subnets**: VM subnet for application instances, PSC subnet for service connections
2. **NAT gateway**: Provides internet access for VMs while keeping them private
3. **PSC endpoint**: Secure connection to producer services
4. **Firewall rules**: Restrictive access policies for security

### Module Dependencies

The deployment uses a modular approach with proper dependency management:

- **Consumer Infrastructure Module**: Creates VPC, subnets, NAT, and PSC endpoint, outputting their self_links
- **Create VM Module**: Uses the VPC and subnet self_links from the infrastructure module, ensuring it references the exact resources created by the consumer module

This approach ensures that the VM is always created in the correct VPC and subnet, and creates a proper dependency chain between modules.

This architecture ensures secure, private communication between consumer applications and producer services while maintaining proper network isolation. 