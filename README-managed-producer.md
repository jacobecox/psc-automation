# Managed Producer Infrastructure

This module provides a managed approach to setting up producer infrastructure for Private Service Connect (PSC) using Terraform.

## Features

The managed producer route automatically:

1. **Enables Required APIs**:
   - Cloud Resource Manager API (`cloudresourcemanager.googleapis.com`)
   - SQL Admin API (`sqladmin.googleapis.com`)
   - Compute Engine API (`compute.googleapis.com`)
   - Service Networking API (`servicenetworking.googleapis.com`)

2. **Creates Network Infrastructure**:
   - VPC named "producer-vpc"
   - Subnet named "producer-subnet" with CIDR `10.0.0.0/24`
   - Default firewall rules for internal communication and SSH access

3. **Sets Up Private Service Access**:
   - Allocates IP range for Private Service Connect (PSC)
   - Creates Private Service Connection for VPC peering
   - Enables private access to Google services

## API Endpoints

### Deploy Managed Producer Infrastructure

**POST** `/producerManaged/deploy/managed`

**Request Body:**
```json
{
  "project_id": "producer-project-463519",  // optional, defaults to "producer-project-463519"
  "region": "us-central1"  // optional, defaults to us-central1
}
```

**Response:**
```json
{
  "message": "Managed Producer infrastructure deployed successfully",
  "project_id": "producer-project-463519",
  "region": "us-central1",
  "vpc_name": "producer-vpc",
  "subnet_name": "producer-subnet",
  "psc_ip_range": "10.1.0.0/16",
  "psc_ip_range_name": "psc-ip-range",
  "vpc_self_link": "https://www.googleapis.com/compute/v1/projects/...",
  "subnet_self_link": "https://www.googleapis.com/compute/v1/projects/...",
  "terraform_output": {
    // Full Terraform output object
  }
}
```

### Get Managed Producer Status

**GET** `/producerManaged/status/managed?project_id=your-gcp-project-id`

**Response:**
```json
{
  "message": "Managed Producer infrastructure status retrieved successfully",
  "project_id": "your-gcp-project-id",
  "region": "us-central1",
  "vpc_name": "producer-vpc",
  "subnet_name": "producer-subnet",
  "psc_ip_address": "10.0.0.100",
  "vpc_self_link": "https://www.googleapis.com/compute/v1/projects/...",
  "subnet_self_link": "https://www.googleapis.com/compute/v1/projects/...",
  "terraform_output": {
    // Full Terraform output object
  }
}
```

## Terraform Configuration

The Terraform configuration is located in `terraform/producer-managed/` and includes:

- **main.tf**: Main infrastructure configuration
- **variables.tf**: Input variables definition

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

3. **Private Service Access**:
   - `google_compute_global_address.psc_ip_range`
   - `google_service_networking_connection.psc_connection`

## Usage Example

```bash
# Method 1: Deploy with NO project_id (uses default: producer-project-463519)
curl -X POST http://localhost:3000/producerManaged/deploy/managed \
  -H "Content-Type: application/json" \
  -d '{
    "region": "us-central1"
  }'

# Method 2: Deploy with explicit default project_id
curl -X POST http://localhost:3000/producerManaged/deploy/managed \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "producer-project-463519",
    "region": "us-central1"
  }'

# Method 3: Deploy with custom project ID
curl -X POST http://localhost:3000/producerManaged/deploy/managed \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "your-custom-project-id",
    "region": "us-central1"
  }'

# Check status with default project ID
curl "http://localhost:3000/producerManaged/status/managed?project_id=producer-project-463519"

# Check status with custom project ID
curl "http://localhost:3000/producerManaged/status/managed?project_id=your-custom-project-id"
```

## Project ID Behavior

The `project_id` parameter is **optional** in the request body:

- **If omitted**: Uses the default project ID `"producer-project-463519"`
- **If provided**: Uses the specified project ID
- **If empty/null**: Returns a validation error

This allows for flexible usage while providing sensible defaults for common scenarios.

## Prerequisites

1. **Google Cloud SDK**: Must be installed and configured
2. **Terraform**: Must be installed and available in PATH
3. **Service Account**: Must have appropriate permissions for:
   - Enabling APIs
   - Creating VPC networks and subnets
   - Creating firewall rules
   - Reserving IP addresses

## Error Handling

The API provides detailed error messages for:
- Invalid project ID or region
- Terraform execution failures
- Missing or malformed requests
- Infrastructure deployment issues

## Testing

Use the provided test script:

```bash
node test-managed-producer.js
```

This will test both the deployment and status endpoints with a sample project ID. 