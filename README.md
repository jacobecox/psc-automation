# PSC Automation - Private Service Connect Infrastructure

This project provides automated infrastructure deployment for Google Cloud Platform's Private Service Connect (PSC) using Terraform and Node.js/Express. It enables teams to quickly set up producer and consumer infrastructure for secure service-to-service communication.

## 🚀 Quick Start

### Prerequisites

1. **Google Cloud SDK** installed and configured
2. **Node.js** (v18 or higher)
3. **Terraform** (v1.0 or higher)
4. **Service Account** with appropriate permissions

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd psc-automation

# Install dependencies
npm install

# Build the project
npm run build

# Set up environment variables
cp .env.example .env
# Edit .env with your service account credentials

# Start the server
npm start
```

The server will start on `http://localhost:3000`

## 📋 Available Routes

### 1. Producer (`/api/producer`)
Complete producer infrastructure with SQL instance and PSC enabled.

**Endpoints:**
- `POST /api/producer/deploy/managed` - Deploy full producer infrastructure with SQL instance

### 2. Consumer (`/api/consumer`)
Consumer infrastructure with VPC, subnets, PSC endpoint, and optional VM creation.

**Endpoints:**
- `POST /api/consumer/deploy/consumer` - Deploy consumer infrastructure and optionally create VM

## 🔧 Required Variables

### Producer Route
- `project_id` (required) - GCP project ID for producer
- `region` (required) - GCP region (e.g., "us-central1")
- `allowed_consumer_project_ids` (required) - Array of consumer project IDs

### Consumer Route
- `project_id` (required) - GCP project ID for consumer
- `region` (required) - GCP region (e.g., "us-central1")
- `service_attachment_uri` (required) - Producer's service attachment URI

## 🛠️ Service Account Permissions

### Consumer Projects
The service account needs the **Editor** role on consumer projects:

```bash
gcloud projects add-iam-policy-binding CONSUMER_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/editor"
```

### Producer Projects
The service account needs these roles on producer projects:

```bash
# Basic permissions
gcloud projects add-iam-policy-binding PRODUCER_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/editor"

# Networking permissions for VPC peering and PSC
gcloud projects add-iam-policy-binding PRODUCER_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/servicenetworking.admin"

gcloud projects add-iam-policy-binding PRODUCER_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/compute.networkAdmin"
```

## 📖 Detailed Documentation

- [Producer Documentation](README-producer.md) - Complete producer setup with SQL
- [Consumer Documentation](README-consumer.md) - Consumer infrastructure setup

## 🔄 Typical Workflow

1. **Deploy Producer Infrastructure:**
   ```bash
   curl -X POST http://localhost:3000/api/producer/deploy/managed \
     -H "Content-Type: application/json" \
     -d '{
       "project_id": "producer-project-123",
       "region": "us-central1",
       "allowed_consumer_project_ids": ["consumer-project-456"]
     }'
   ```

2. **Deploy Consumer Infrastructure:**
   ```bash
   curl -X POST http://localhost:3000/api/consumer/deploy/consumer \
     -H "Content-Type: application/json" \
     -d '{
       "project_id": "consumer-project-456",
       "region": "us-central1",
       "service_attachment_uri": "projects/producer-project-123/regions/us-central1/serviceAttachments/producer-sql-psc"
     }'
   ```

## 🏗️ Terraform Modules

- `terraform/producer/` - Producer infrastructure with SQL
- `terraform/consumer/` - Consumer VPC and PSC endpoint

## 🔍 Monitoring and Debugging

- **Debug Endpoint:** `GET /debug` - Check server status
- **Health Check:** `GET /` - Basic health check
- **Logs:** All operations are logged with detailed checkpoints

## ⚠️ Important Notes

- **No Defaults:** `project_id` and `region` are required for all operations
- **API Enablement:** Automatically enables required APIs for each project
- **Timeouts:** Operations have extended timeouts for reliability
- **Error Handling:** Comprehensive error handling with retry logic

## 🚨 Error Handling

The system provides detailed error messages for:
- Permission issues with clear resolution steps
- Invalid parameters with validation details
- Terraform execution failures
- API enablement issues

## 📞 Support

For issues or questions:
1. Check the detailed module documentation
2. Review error messages for resolution steps
3. Check server logs for detailed operation information

## 🔄 Version History

- **v2.0.0** - Simplified structure with producer and consumer routes
- **v1.0.0** - Initial release with multiple standalone modules 