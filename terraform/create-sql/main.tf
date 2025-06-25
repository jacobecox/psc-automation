terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Data sources to reference existing VPC and subnet from managed producer
data "google_compute_network" "producer_vpc" {
  name    = "producer-vpc"
  project = var.project_id
}

data "google_compute_subnetwork" "producer_subnet" {
  name    = "producer-subnet"
  region  = var.region
  project = var.project_id
}

# Create Cloud SQL instance
resource "google_sql_database_instance" "producer_sql" {
  name             = var.instance_id
  database_version = "POSTGRES_17"
  region           = var.region
  project          = var.project_id

  settings {
    tier = "db-f1-micro"
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = data.google_compute_network.producer_vpc.self_link
    }
    
    backup_configuration {
      enabled    = true
      start_time = "02:00"
    }
    
    maintenance_window {
      day          = 7
      hour         = 2
      update_track = "stable"
    }
  }

  deletion_protection = false
}

# Enable Private Service Connect automatically when instance is created
# Note: We use null_resource with local-exec provisioner because psc_config block
# is not supported in the Terraform Google provider for Cloud SQL instances.
# The psc_config block would be the ideal way to enable PSC, but since it's not
# available, we use gcloud commands via null_resource to enable PSC after
# the instance is created.
resource "null_resource" "enable_psc" {
  depends_on = [google_sql_database_instance.producer_sql]

  # Use triggers to ensure this runs when the instance is created or updated
  triggers = {
    instance_name = google_sql_database_instance.producer_sql.name
    instance_self_link = google_sql_database_instance.producer_sql.self_link
    project_id = var.project_id
    consumer_project = var.allowed_consumer_project_id
  }

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command = <<EOT
      set -e
      
      echo "Starting automatic PSC enablement process..."
      echo "Instance: ${google_sql_database_instance.producer_sql.name}"
      echo "Project: ${var.project_id}"
      echo "Consumer Project: ${var.allowed_consumer_project_id}"
      
      # Wait for instance to be ready
      echo "Waiting for Cloud SQL instance to be fully ready..."
      sleep 30
      
      echo "Checking if gcloud is available..."
      if ! command -v gcloud &> /dev/null; then
        echo "ERROR: gcloud command not found. Please install Google Cloud SDK."
        exit 1
      fi
      
      echo "Checking instance status..."
      for i in {1..15}; do
        if gcloud sql instances describe ${google_sql_database_instance.producer_sql.name} \
          --project=${var.project_id} \
          --format="value(state)" | grep -q "RUNNABLE"; then
          echo "Instance is in RUNNABLE state"
          break
        else
          echo "Instance not ready yet, waiting... (attempt $i/15)"
          sleep 30
        fi
        
        if [ $i -eq 15 ]; then
          echo "ERROR: Instance did not become ready within expected time"
          exit 1
        fi
      done
      
      echo "Checking if PSC is already enabled..."
      if gcloud sql instances describe ${google_sql_database_instance.producer_sql.name} \
        --project=${var.project_id} \
        --format="value(settings.ipConfiguration.pscConfig.pscEnabled)" | grep -q "True"; then
        echo "PSC is already enabled, skipping enablement"
        exit 0
      fi
      
      echo "PSC not enabled, attempting to enable it..."
      echo "Note: PSC enablement can take 5-10 minutes to complete..."
      
      # Submit PSC enablement operation and exit immediately
      # The application will handle polling for completion
      gcloud sql instances patch ${google_sql_database_instance.producer_sql.name} \
        --project=${var.project_id} \
        --enable-private-service-connect \
        --allowed-psc-projects=${var.allowed_consumer_project_id} \
        --quiet
      
      echo "PSC enablement operation submitted successfully"
      echo "The application will poll for completion"
      exit 0
    EOT
  }
}

# Create default user with specified password
resource "google_sql_user" "default_user" {
  name     = "postgres"
  instance = google_sql_database_instance.producer_sql.name
  password = var.default_password
  project  = var.project_id
}

# Outputs
output "instance_name" {
  description = "The name of the Cloud SQL instance"
  value       = google_sql_database_instance.producer_sql.name
}

output "instance_connection_name" {
  description = "The connection name of the Cloud SQL instance"
  value       = google_sql_database_instance.producer_sql.connection_name
}

output "private_ip_address" {
  description = "The private IP address of the Cloud SQL instance"
  value       = google_sql_database_instance.producer_sql.private_ip_address
}

output "database_name" {
  description = "The name of the default database (created automatically)"
  value       = "postgres"
}

output "user_name" {
  description = "The name of the default user"
  value       = google_sql_user.default_user.name
}

output "project_id" {
  description = "The project ID where the Cloud SQL instance was created"
  value       = var.project_id
}

output "region" {
  description = "The region where the Cloud SQL instance was created"
  value       = var.region
}

output "allowed_consumer_project_id" {
  description = "The project ID allowed for private service connect"
  value       = var.allowed_consumer_project_id
} 