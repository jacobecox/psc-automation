# Managed Producer Infrastructure

This module provides a managed approach to setting up producer infrastructure for Private Service Connect (PSC) using Terraform.

## Prerequisites

Before using this automation, ensure that the service account `central-service-account@admin-project-463522.iam.gserviceaccount.com` has the necessary permissions on the target project:

### Required Permissions

The service account needs these roles on the producer project:
- `roles/editor` - For general resource management
- `roles/servicenetworking.admin` - For VPC peering operations
- `roles/compute.networkAdmin` - For networking operations

### Granting Permissions

You can grant the required permissions using one of these methods:

**Option 1: Use the provided script**
```bash
chmod +x grant-permissions.sh
./grant-permissions.sh your-project-id
```

**Option 2: Manual gcloud commands**
```bash
# Basic permissions
gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:central-service-account@admin-project-463522.iam.gserviceaccount.com" \
  --role="roles/editor"

# Networking permissions for VPC peering and PSC
gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:central-service-account@admin-project-463522.iam.gserviceaccount.com" \
  --role="roles/servicenetworking.admin"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:central-service-account@admin-project-463522.iam.gserviceaccount.com" \
  --role="roles/compute.networkAdmin"
```

### Error Handling

If you encounter permission errors during deployment, the system will provide clear guidance on how to resolve them. The error messages will include the exact commands needed to grant the necessary permissions.

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

4. **Automatically Creates Cloud SQL Instance**:
   - Creates a PostgreSQL instance with configurable settings
   - Enables Private Service Connect for secure access
   - Configurable machine type, database version, backup settings, and maintenance window

## API Endpoints

### Deploy Managed Producer Infrastructure

**POST** `/api/producer-managed/deploy/managed`

**Request Body:**
```json
{
  "project_id": "producer-project-463519",  // required
  "region": "us-central1",  // required
  "allowed_consumer_project_ids": ["consumer-project-463821"]  // required
}
```

**Response:**
```json
{
  "message": "Managed Producer infrastructure and SQL instance deployed successfully with PSC enabled",
  "project_id": "producer-project-463519",
  "region": "us-central1",
  "vpc_name": "producer-vpc",
  "subnet_name": "producer-subnet",
  "psc_ip_range": "10.1.0.0/16",
  "psc_ip_range_name": "psc-ip-range",
  "vpc_self_link": "https://www.googleapis.com/compute/v1/projects/...",
  "subnet_self_link": "https://www.googleapis.com/compute/v1/projects/...",
  "sql_creation_result": {
    "success": true,
    "message": "SQL instance created successfully with PSC enabled",
    "instance_name": "producer-sql",
    "instance_connection_name": "producer-project-463519:us-central1:producer-sql",
    "private_ip_address": "10.0.0.100",
    "database_name": "postgres",
    "user_name": "postgres",
    "allowed_consumer_project_ids": ["consumer-project-463821"],
    "service_attachment_uri": "projects/producer-project-463519/regions/us-central1/serviceAttachments/producer-sql-psc",
    "terraform_output": {
      // Full Terraform output object
    },
    "psc_enabled": true
  },
  "terraform_output": {
    // Full Terraform output object
  }
}
```

### Create SQL Instance (Standalone)

**POST** `/api/create-sql/deploy/create-sql`

**Request Body:**
```json
{
  "project_id": "producer-project-463519",  // required
  "region": "us-central1",  // required
  "instance_name": "producer-sql",  // optional, defaults to "producer-sql"
  "default_password": "postgres",  // optional, defaults to "postgres"
  "allowed_consumer_project_ids": ["consumer-project-463821"],  // required
  "tier": "db-f1-micro",  // optional, defaults to "db-f1-micro"
  "database_version": "POSTGRES_17",  // optional, defaults to "POSTGRES_17"
  "deletion_protection": false,  // optional, defaults to false
  "backup_enabled": true,  // optional, defaults to true
  "backup_start_time": "02:00",  // optional, defaults to "02:00"
  "maintenance_day": 7,  // optional, defaults to 7 (Saturday)
  "maintenance_hour": 2,  // optional, defaults to 2 (2 AM)
  "maintenance_update_track": "stable"  // optional, defaults to "stable"
}
```

**SQL Configuration Parameters:**

- **tier**: Machine type for the SQL instance (e.g., "db-f1-micro", "db-n1-standard-1", "db-n1-standard-2")
- **database_version**: PostgreSQL version (e.g., "POSTGRES_17", "POSTGRES_16", "POSTGRES_15")
- **deletion_protection**: Whether to enable deletion protection (true/false)
- **backup_enabled**: Whether to enable automated backups (true/false)
- **backup_start_time**: Time for daily backups in HH:MM format (24-hour)
- **maintenance_day**: Day of week for maintenance (1=Sunday, 7=Saturday)
- **maintenance_hour**: Hour of day for maintenance (0-23, 24-hour format)
- **maintenance_update_track**: Update track for maintenance ("stable" or "preview")

**Response:**
```json
{
  "message": "SQL infrastructure deployed successfully with PSC enabled",
  "project_id": "producer-project-463519",
  "region": "us-central1",
  "instance_name": "producer-sql",
  "instance_connection_name": "producer-project-463519:us-central1:producer-sql",
  "private_ip_address": "10.0.0.100",
  "database_name": "postgres",
  "user_name": "postgres",
  "allowed_consumer_project_ids": ["consumer-project-463821"],
  "service_attachment_uri": "projects/producer-project-463519/regions/us-central1/serviceAttachments/producer-sql-psc",
  "terraform_output": {
    // Full Terraform output object
  },
  "psc_enabled": true
}
```

### Get Managed Producer Status

**GET** `/api/producer-managed/status/managed?project_id=your-gcp-project-id`

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

### Get SQL Instance Status

**GET** `/api/create-sql/status/create-sql?project_id=your-gcp-project-id`

**Response:**
```json
{
  "message": "SQL infrastructure status retrieved successfully",
  "project_id": "your-gcp-project-id",
  "region": "us-central1",
  "instance_name": "producer-sql",
  "instance_connection_name": "producer-project-463519:us-central1:producer-sql",
  "private_ip_address": "10.0.0.100",
  "database_name": "postgres",
  "user_name": "postgres",
  "allowed_consumer_project_ids": ["consumer-project-463821"],
  "service_attachment_uri": "projects/producer-project-463519/regions/us-central1/serviceAttachments/producer-sql-psc",
  "terraform_output": {
    // Full Terraform output object
  }
}
```

## Terraform Configuration

The Terraform configuration is located in `terraform/producer-managed/` and includes:

- **api-enablement.tf**: API enablement configuration
- **infrastructure.tf**: Main infrastructure configuration
- **variables.tf**: Input variables definition

### Required Variables

- `project_id` (required) - GCP project ID for producer
- `region` (required) - GCP region (e.g., "us-central1")
- `allowed_consumer_project_ids` (required) - Array of consumer project IDs

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

4. **Cloud SQL Instance**:
   - `google_sql_database_instance.producer_sql`
   - `google_sql_user.default_user`
   - `null_resource.enable_psc` (enables Private Service Connect)

## Usage Examples

### Basic Deployment (Required Parameters)
```bash
# Deploy with required parameters
curl -X POST http://localhost:3000/api/producer-managed/deploy/managed \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "producer-project-463519",
    "region": "us-central1",
    "allowed_consumer_project_ids": ["consumer-project-463821"]
  }'
```

### Custom SQL Configuration
```bash
# Deploy with custom SQL settings
curl -X POST http://localhost:3000/api/create-sql/deploy/create-sql \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "producer-project-463519",
    "region": "us-central1",
    "allowed_consumer_project_ids": ["consumer-project-463821"],
    "tier": "db-n1-standard-1",
    "database_version": "POSTGRES_16",
    "deletion_protection": true,
    "backup_enabled": true,
    "backup_start_time": "03:00",
    "maintenance_day": 1,
    "maintenance_hour": 3,
    "maintenance_update_track": "stable"
  }'
```

### Production-Ready Configuration
```bash
# Production-ready SQL instance
curl -X POST http://localhost:3000/api/create-sql/deploy/create-sql \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "producer-project-463519",
    "region": "us-central1",
    "allowed_consumer_project_ids": ["consumer-project-463821"],
    "tier": "db-n1-standard-2",
    "database_version": "POSTGRES_17",
    "deletion_protection": true,
    "backup_enabled": true,
    "backup_start_time": "02:00",
    "maintenance_day": 7,
    "maintenance_hour": 2,
    "maintenance_update_track": "stable"
  }'
```

## Available Machine Types (Tiers)

- **db-f1-micro**: 1 vCPU, 0.6 GB RAM (free tier)
- **db-g1-small**: 1 vCPU, 1.7 GB RAM
- **db-n1-standard-1**: 1 vCPU, 3.75 GB RAM
- **db-n1-standard-2**: 2 vCPU, 7.5 GB RAM
- **db-n1-standard-4**: 4 vCPU, 15 GB RAM
- **db-n1-standard-8**: 8 vCPU, 30 GB RAM
- **db-n1-standard-16**: 16 vCPU, 60 GB RAM
- **db-n1-standard-32**: 32 vCPU, 120 GB RAM

## Available Database Versions

- **POSTGRES_17**: PostgreSQL 17 (latest)
- **POSTGRES_16**: PostgreSQL 16
- **POSTGRES_15**: PostgreSQL 15
- **POSTGRES_14**: PostgreSQL 14
- **POSTGRES_13**: PostgreSQL 13
- **POSTGRES_12**: PostgreSQL 12

## Required Parameters

The following parameters are **required** and have no defaults:

- `project_id` - Must be provided in all requests
- `region` - Must be provided in all requests
- `allowed_consumer_project_ids` - Must be provided as an array of project IDs

This ensures explicit configuration and prevents accidental deployments to wrong projects.

## State Management

The producer-managed module uses Terraform workspaces for state isolation:
- Workspace name is derived from the project ID
- Ensures clean state separation between different projects
- Prevents conflicts when managing multiple producer projects

## Timeouts and Performance

- **Deployment Timeout**: 45 minutes for SQL operations, 15 minutes for others
- **API Propagation**: 60 seconds wait after API enablement
- **PSC Polling**: 30 seconds intervals for PSC completion monitoring
- **SQL Creation**: Extended timeout for SQL instance provisioning

## Error Handling

The system provides detailed error messages for:
- Permission issues with clear resolution steps
- Invalid parameters with validation details
- Terraform execution failures
- API enablement issues
- PSC enablement timeouts