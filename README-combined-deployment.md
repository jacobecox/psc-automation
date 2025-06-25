# Combined PSC Deployment

This document shows how the differentiated project IDs enable future combined deployment routes.

## Future Combined Route Example

With the current API structure using `producer_project_id` and `consumer_project_id`, you could create a combined route that deploys both producer and consumer infrastructure in a single request:

### Combined Deployment Route (Future Implementation)

**POST** `/api/combined/deploy/psc`

**Request Body:**
```json
{
  "producer_project_id": "producer-project-463519",  // required
  "consumer_project_id": "consumer-test-project-463821",  // required
  "region": "us-central1",  // optional, defaults to us-central1
  "sql_config": {
    "instance_id": "producer-sql",  // optional
    "tier": "db-f1-micro",  // optional
    "database_version": "POSTGRES_17",  // optional
    "allowed_consumer_project_id": "consumer-test-project-463821"  // optional, defaults to consumer_project_id
  }
}
```

**Response:**
```json
{
  "message": "PSC infrastructure deployed successfully",
  "producer": {
    "project_id": "producer-project-463519",
    "region": "us-central1",
    "vpc_name": "producer-vpc",
    "subnet_name": "producer-subnet",
    "service_attachment_uri": "projects/producer-project-463519/regions/us-central1/serviceAttachments/producer-sql-psc",
    "sql_instance": {
      "instance_name": "producer-sql",
      "private_ip_address": "10.0.0.100",
      "connection_name": "producer-project-463519:us-central1:producer-sql"
    }
  },
  "consumer": {
    "project_id": "consumer-test-project-463821",
    "region": "us-central1",
    "vpc_name": "consumer-vpc",
    "vm_subnet_name": "vm-subnet",
    "psc_subnet_name": "psc-subnet",
    "psc_endpoint_name": "psc-endpoint",
    "psc_ip_address": "10.2.0.2"
  },
  "connection_status": "established"
}
```

## Benefits of Differentiated Project IDs

1. **Clear Separation**: No ambiguity about which project is which
2. **Flexible Deployment**: Can deploy producer and consumer independently or together
3. **Cross-Project Communication**: Enables secure communication between different projects
4. **Scalability**: Can easily add more consumers or producers
5. **Security**: Each project can have different IAM policies and security configurations

## Current Individual Routes

### Producer Routes
- **POST** `/api/producerManaged/deploy/managed` - Deploy producer infrastructure
- **POST** `/api/createSql/deploy/create-sql` - Create SQL instance
- **GET** `/api/producerManaged/status/managed` - Get producer status
- **GET** `/api/createSql/status/create-sql` - Get SQL status

### Consumer Routes
- **POST** `/api/consumer/deploy/consumer` - Deploy consumer infrastructure

## Migration Path

The current routes maintain backward compatibility while enabling future combined deployments:

1. **Current**: Use individual routes with specific project IDs
2. **Future**: Use combined routes for end-to-end deployment
3. **Hybrid**: Mix individual and combined routes as needed

## Example Usage Scenarios

### Scenario 1: Independent Deployment
```bash
# Deploy producer first
curl -X POST http://localhost:3000/api/producerManaged/deploy/managed \
  -H "Content-Type: application/json" \
  -d '{"producer_project_id": "producer-project-463519"}'

# Deploy consumer later
curl -X POST http://localhost:3000/api/consumer/deploy/consumer \
  -H "Content-Type: application/json" \
  -d '{
    "consumer_project_id": "consumer-test-project-463821",
    "service_attachment_uri": "projects/producer-project-463519/regions/us-central1/serviceAttachments/producer-sql-psc"
  }'
```

### Scenario 2: Combined Deployment (Future)
```bash
# Deploy both in one request
curl -X POST http://localhost:3000/api/combined/deploy/psc \
  -H "Content-Type: application/json" \
  -d '{
    "producer_project_id": "producer-project-463519",
    "consumer_project_id": "consumer-test-project-463821",
    "sql_config": {
      "tier": "db-n1-standard-1"
    }
  }'
```

This structure provides maximum flexibility for different deployment scenarios while maintaining clear project separation. 