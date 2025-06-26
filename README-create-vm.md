# Create VM Infrastructure

This module provides automation for creating VM instances in the consumer VPC for Private Service Connect (PSC) using Terraform.

## Prerequisites

Before using this automation, ensure that the service account `central-service-account@admin-project-463522.iam.gserviceaccount.com` has the necessary permissions on the consumer project:

### Required Permissions

The service account needs the following roles on the consumer project:
- `roles/editor` - For general resource management
- `roles/serviceusage.serviceUsageAdmin` - For API enablement
- `roles/resourcemanager.projectIamAdmin` - For IAM management

### Granting Permissions

You can grant the required permissions using one of these methods:

**Option 1: Manual gcloud command**
```bash
gcloud projects add-iam-policy-binding your-consumer-project-id \
  --member="serviceAccount:central-service-account@admin-project-463522.iam.gserviceaccount.com" \
  --role="roles/editor"
```

**Option 2: Grant all required roles**
```bash
gcloud projects add-iam-policy-binding your-consumer-project-id \
  --member="serviceAccount:central-service-account@admin-project-463522.iam.gserviceaccount.com" \
  --role="roles/editor"

gcloud projects add-iam-policy-binding your-consumer-project-id \
  --member="serviceAccount:central-service-account@admin-project-463522.iam.gserviceaccount.com" \
  --role="roles/serviceusage.serviceUsageAdmin"

gcloud projects add-iam-policy-binding your-consumer-project-id \
  --member="serviceAccount:central-service-account@admin-project-463522.iam.gserviceaccount.com" \
  --role="roles/resourcemanager.projectIamAdmin"
```

### Error Handling

If you encounter permission errors during deployment, the system will provide clear guidance on how to resolve them. The error messages will include the exact commands needed to grant the necessary permissions.

## Features

The create VM route automatically:

1. **Creates VM Instance**:
   - Creates a VM instance in the `vm-subnet` of the `consumer-vpc`
   - Configurable instance name, machine type, and OS image
   - No external IP (uses Cloud NAT for internet access)
   - Automatically installs required packages on startup

2. **Startup Script**:
   - Installs PostgreSQL client (`psql`)
   - Installs ping utility (`iputils-ping`)
   - Installs telnet client (`telnet`)
   - Creates installation log file

**Note**: This module assumes that the Compute Engine API is already enabled by the consumer route. It does not enable any APIs itself.

## API Endpoints

### Create VM Instance

**POST** `/api/create-vm/deploy/create-vm`

**Request Body:**
```json
{
  "consumer_project_id": "consumer-test-project-463821",  // required
  "region": "us-central1",  // optional, defaults to us-central1
  "instance_name": "consumer-vm",  // optional, defaults to "consumer-vm"
  "machine_type": "e2-micro",  // optional, defaults to "e2-micro"
  "os_image": "debian-cloud/debian-12"  // optional, defaults to "debian-cloud/debian-12"
}
```

**VM Configuration Parameters:**

- **consumer_project_id**: The consumer project ID where the VM will be created (required)
- **region**: GCP region for the VM (optional, defaults to "us-central1")
- **instance_name**: Name for the VM instance (optional, defaults to "consumer-vm")
- **machine_type**: GCP machine type (optional, defaults to "e2-micro")
  - Common options: "e2-micro", "e2-small", "e2-medium", "n1-standard-1", "n1-standard-2"
- **os_image**: GCP OS image (optional, defaults to "debian-cloud/debian-12")
  - Common options: "debian-cloud/debian-12", "ubuntu-os-cloud/ubuntu-2204-lts", "centos-cloud/centos-7"

**Response:**
```json
{
  "message": "VM created successfully in consumer VPC",
  "consumer_project_id": "consumer-test-project-463821",
  "region": "us-central1",
  "instance_name": "consumer-vm",
  "instance_id": "1234567890123456789",
  "zone": "us-central1-a",
  "internal_ip": "10.1.0.2",
  "subnet_name": "vm-subnet",
  "vpc_name": "consumer-vpc",
  "machine_type": "e2-micro",
  "os_image": "debian-cloud/debian-12",
  "terraform_output": {
    // Full Terraform output object
  }
}
```

### Get VM Status

**GET** `/api/create-vm/status/create-vm?consumer_project_id=your-consumer-project-id`

**Response:**
```json
{
  "message": "VM status retrieved successfully",
  "consumer_project_id": "consumer-test-project-463821",
  "region": "us-central1",
  "instance_name": "consumer-vm",
  "instance_id": "1234567890123456789",
  "zone": "us-central1-a",
  "internal_ip": "10.1.0.2",
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

The Terraform configuration is located in `terraform/create-vm/` and includes:

- **main.tf**: Main VM configuration
- **variables.tf**: Input variables definition

### Resources Created

1. **VM Instance**:
   - `google_compute_instance.consumer_vm`
     - Located in `vm-subnet` of `consumer-vpc`
     - No external IP (uses Cloud NAT)
     - Startup script for package installation
     - Configurable machine type and OS image

**Note**: This module does not enable any APIs. It assumes the Compute Engine API is already enabled by the consumer route.

## Testing

Test the VM creation:

```bash
# Basic VM creation with defaults
curl -X POST http://localhost:3000/api/create-vm/deploy/create-vm \
  -H "Content-Type: application/json" \
  -d '{
    "consumer_project_id": "consumer-test-project-463821"
  }'

# VM creation with custom configuration
curl -X POST http://localhost:3000/api/create-vm/deploy/create-vm \
  -H "Content-Type: application/json" \
  -d '{
    "consumer_project_id": "consumer-test-project-463821",
    "region": "us-central1",
    "instance_name": "my-custom-vm",
    "machine_type": "e2-small",
    "os_image": "ubuntu-os-cloud/ubuntu-2204-lts"
  }'

# Check VM status
curl -X GET "http://localhost:3000/api/create-vm/status/create-vm?consumer_project_id=consumer-test-project-463821"
```

## VM Specifications

### Default Configuration
- **Instance Name**: `consumer-vm`
- **Machine Type**: `e2-micro` (2 vCPUs, 1 GB memory)
- **OS Image**: `debian-cloud/debian-12` (Debian GNU/Linux 12)
- **Zone**: `{region}-a` (e.g., `us-central1-a`)
- **Boot Disk**: 20 GB standard persistent disk
- **Network**: `vm-subnet` in `consumer-vpc`
- **External IP**: None (uses Cloud NAT for internet access)

### Startup Script
The VM automatically runs this script on first boot:
```bash
#!/bin/bash
apt-get update -y

# Install PostgreSQL client
apt-get install -y postgresql-client

# Install ping (usually comes by default)
apt-get install -y iputils-ping

# Install telnet
apt-get install -y telnet

# Create a log file to track installation
echo "VM startup script completed at $(date)" > /var/log/vm-startup.log
```

## Network Architecture

The VM is created in the consumer VPC architecture:

1. **VM Subnet** (`10.1.0.0/24`):
   - VM instances are placed in this subnet
   - Connected to Cloud NAT for outbound internet access
   - Can access the producer's SQL instance via PSC

2. **Security**:
   - No external IP address (private only)
   - Uses Cloud NAT for internet access
   - Protected by VPC firewall rules
   - Can only be accessed via IAP or VPN

## Error Handling

The API provides detailed error messages for:
- Invalid consumer project ID, region, or VM parameters
- Permission denied errors with clear resolution steps
- Terraform execution failures
- Missing or malformed requests
- VM creation issues

## Integration with PSC

This VM is designed to work with the PSC infrastructure:

1. **Producer**: SQL instance with PSC enabled
2. **Consumer**: VPC with PSC endpoint
3. **VM**: Created in consumer VPC, can connect to producer SQL via PSC

The VM can connect to the producer's SQL instance using:
```bash
psql -h <producer-private-ip> -U postgres -d postgres
```

Where `<producer-private-ip>` is the private IP address of the SQL instance in the producer VPC. 