# Producer Infrastructure

This module provides automation for setting up producer infrastructure for Private Service Connect (PSC) using Terraform.

## Prerequisites

Before using this automation, ensure that the service account has the necessary permissions on the target project:

### Required Permissions

The service account needs these roles on the producer project:
- `roles/editor` - For general resource management
- `roles/servicenetworking.admin` - For VPC peering operations
- `roles/compute.networkAdmin` - For networking operations

### Granting Permissions

You can grant the required permissions using these gcloud commands:

```bash
# Basic permissions
gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/editor"

# Networking permissions for VPC peering and PSC
gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/servicenetworking.admin"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/compute.networkAdmin"
```

### Error Handling

If you encounter permission errors during deployment, the system will provide clear guidance on how to resolve them. The error messages will include the exact commands needed to grant the necessary permissions.

## Features

The producer route automatically:

1. **Enables Required APIs**:
   - Cloud Resource Manager API (`cloudresourcemanager.googleapis.com`)
   - SQL Admin API (`sqladmin.googleapis.com`)
   - Compute Engine API (`compute.googleapis.com`)
   - Service Networking API (`servicenetworking.googleapis.com`)

2. **Creates Network Infrastructure**:
   - VPC with configurable name (default: "producer-vpc")
   - Subnet with configurable name (default: "producer-subnet") and CIDR (default: `10.0.0.0/24`)
   - Default firewall rules for internal communication and SSH access

3. **Sets Up Private Service Access**:
   - Allocates IP range for Private Service Connect (PSC)
   - Creates Private Service Connection for VPC peering
   - Enables private access to Google services

4. **Creates Cloud SQL Instance**:
   - Creates a PostgreSQL instance with configurable settings
   - Enables Private Service Connect for secure access
   - Configurable machine type, database version, backup settings, and maintenance window

## API Endpoints

### Deploy Producer Infrastructure

**POST** `/api/producer/deploy/managed`

**Request Body:**
```json
{
  "project_id": "producer-project-123",  // required
  "region": "us-central1",  // required
  "allowed_consumer_project_ids": ["consumer-project-456"],  // required
  "subnet_cidr_range": "10.0.0.0/24",  // optional, defaults to "10.0.0.0/24"
  "internal_firewall_source_ranges": ["10.0.0.0/8"],  // optional, defaults to ["10.0.0.0/8"]
  "psc_ip_range_prefix_length": 16,  // optional, defaults to 16
  "producer_vpc_name": "producer-vpc",  // optional, defaults to "producer-vpc"
  "producer_subnet_name": "producer-subnet",  // optional, defaults to "producer-subnet"
  "instance_id": "producer-sql",  // optional, defaults to "producer-sql"
  "default_password": "postgres"  // optional, defaults to "postgres"
}
```

**Response:**
```json
{
  "message": "Managed Producer infrastructure and SQL instance deployed successfully",
  "project_id": "producer-project-123",
  "region": "us-central1",
  "infrastructure": {
    "vpc_name": "producer-vpc",
    "subnet_name": "producer-subnet",
    "psc_ip_range": "10.1.0.0/16",
    "psc_ip_range_name": "psc-ip-range",
    "vpc_self_link": "https://www.googleapis.com/compute/v1/projects/...",
    "subnet_self_link": "https://www.googleapis.com/compute/v1/projects/..."
  },
  "sql": {
    "instance_name": "producer-sql",
    "instance_connection_name": "producer-project-123:us-central1:producer-sql",
    "private_ip_address": "10.0.0.100",
    "database_name": "postgres",
    "user_name": "postgres",
    "allowed_consumer_project_ids": ["consumer-project-456"],
    "service_attachment_uri": "projects/producer-project-123/regions/us-central1/serviceAttachments/producer-sql-psc"
  }
}
```

## Terraform Configuration

The Terraform configuration is located in `terraform/producer/` and includes:

- **api-enablement.tf**: API enablement configuration
- **infrastructure.tf**: Main infrastructure configuration
- **variables.tf**: Input variables definition

### Required Variables

- `project_id` (required) - GCP project ID for producer
- `region` (required) - GCP region (e.g., "us-central1")
- `allowed_consumer_project_ids` (required) - Array of consumer project IDs

### Optional Variables

- `subnet_cidr_range` (default: "10.0.0.0/24") - CIDR range for the subnet
- `internal_firewall_source_ranges` (default: ["10.0.0.0/8"]) - Source ranges for internal firewall
- `psc_ip_range_prefix_length` (default: 16) - Prefix length for PSC IP range
- `producer_vpc_name` (default: "producer-vpc") - Name of the producer VPC
- `producer_subnet_name` (default: "producer-subnet") - Name of the producer subnet

### Resources Created

1. **Google Project Services**:
   - `google_project_service.cloud_resource_manager`
   - `google_project_service.sql_admin`
   - `google_project_service.compute_engine`
   - `google_project_service.service_networking`

2. **Network Resources**:
   - `google_compute_network.producer_vpc`
   - `google_compute_subnetwork.producer_subnet`
   - `google_compute_firewall.default_allow_internal`
   - `google_compute_firewall.default_allow_ssh`

3. **Private Service Connect**:
   - `google_compute_global_address.psc_ip_range`
   - `google_service_networking_connection.private_vpc_connection`

4. **Cloud SQL Instance**:
   - `google_sql_database_instance.producer_sql`
   - `google_sql_database.producer_database`
   - `google_sql_user.producer_user`

## Testing

Test the producer deployment:

```bash
curl -X POST http://localhost:3000/api/producer/deploy/managed \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "producer-project-123",
    "region": "us-central1",
    "allowed_consumer_project_ids": ["consumer-project-456"]
  }'
```

Test with custom configuration:

```bash
curl -X POST http://localhost:3000/api/producer/deploy/managed \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "producer-project-123",
    "region": "us-central1",
    "allowed_consumer_project_ids": ["consumer-project-456"],
    "producer_vpc_name": "my-custom-vpc",
    "producer_subnet_name": "my-custom-subnet",
    "subnet_cidr_range": "10.1.0.0/24",
    "instance_id": "my-custom-sql",
    "default_password": "mypassword123"
  }'
```

## Error Handling

The producer route includes comprehensive error handling:

- **Validation errors** for missing required fields
- **Terraform execution errors** with detailed logging
- **API enablement errors** with retry logic
- **SQL creation errors** that don't fail the entire deployment

## Architecture

The producer infrastructure creates a secure environment for hosting services:

1. **VPC with subnet**: Isolated network for producer services
2. **Private Service Connect**: Enables secure access from consumer networks
3. **Cloud SQL**: Database instance with PSC enabled
4. **Firewall rules**: Restrictive access policies for security

This architecture ensures secure, private communication between producer services and consumer applications while maintaining proper network isolation.