terraform {
  required_version = ">= 0.13"
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

# Use existing producer VPC
data "google_compute_network" "producer_vpc" {
  name    = "producer-vpc"
  project = var.project_id
}

# Use existing producer subnet
data "google_compute_subnetwork" "producer_subnet" {
  name    = "producer-subnet"
  project = var.project_id
  region  = var.region
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
      private_network = data.google_compute_network.producer_vpc.id
      require_ssl     = false
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

    deletion_protection_enabled = false
  }

  deletion_protection = false
}

# Create database
resource "google_sql_database" "database" {
  name     = "mydb"
  instance = google_sql_database_instance.producer_sql.name
  project  = var.project_id
}

# Create user
resource "google_sql_user" "users" {
  name     = "postgres"
  instance = google_sql_database_instance.producer_sql.name
  password = var.default_password
  project  = var.project_id
}

# Enable Private Service Connect
resource "null_resource" "enable_psc" {
  depends_on = [google_sql_database_instance.producer_sql]

  triggers = {
    # Force re-execution when consumer projects change
    allowed_consumer_project_ids = join(",", var.allowed_consumer_project_ids)
    # Force re-execution when PSC is not enabled (check via data source)
    psc_enabled = data.google_sql_database_instance.producer_sql_data.settings[0].ip_configuration[0].psc_config != null ? "enabled" : "disabled"
    # Also trigger on timestamp to ensure it runs at least once
    timestamp = timestamp()
  }

  provisioner "local-exec" {
    command = <<-EOT
      echo "Checking and enabling Private Service Connect for SQL instance..."
      echo "Project: ${var.project_id}"
      echo "Consumer Projects: ${join(",", var.allowed_consumer_project_ids)}"
      
      # Wait for SQL instance to be ready
      echo "Waiting for SQL instance to be ready..."
      gcloud sql instances describe ${google_sql_database_instance.producer_sql.name} \
        --project=${var.project_id} \
        --format="value(state)" | grep -q "RUNNABLE" || \
        (echo "SQL instance not ready yet, waiting..." && sleep 30)
      
      # Check if PSC is already enabled
      echo "Checking current PSC status..."
      PSC_STATUS=$(gcloud sql instances describe ${google_sql_database_instance.producer_sql.name} \
        --project=${var.project_id} \
        --format="value(settings.ipConfiguration.pscConfig.pscEnabled)" 2>/dev/null || echo "False")
      
      echo "Current PSC status: $PSC_STATUS"
      
      if [ "$PSC_STATUS" = "True" ]; then
        echo "PSC is already enabled, checking consumer projects..."
        
        # Check if consumer projects are already allowed
        CURRENT_CONSUMERS=$(gcloud sql instances describe ${google_sql_database_instance.producer_sql.name} \
          --project=${var.project_id} \
          --format="value(settings.ipConfiguration.pscConfig.allowedConsumerProjects)" 2>/dev/null || echo "")
        
        echo "Current allowed consumers: $CURRENT_CONSUMERS"
        
        # Check if our consumer projects are already in the list
        ALL_CONSUMERS_SET=true
        for consumer in ${join(" ", var.allowed_consumer_project_ids)}; do
          if [[ "$CURRENT_CONSUMERS" != *"$consumer"* ]]; then
            echo "Consumer project $consumer not found in allowed list, updating..."
            ALL_CONSUMERS_SET=false
            break
          fi
        done
        
        if [ "$ALL_CONSUMERS_SET" = "true" ]; then
          echo "All consumer projects already allowed, PSC setup complete"
          exit 0
        fi
      fi
      
      # Wait for any pending operations to complete
      echo "Checking for pending operations..."
      PENDING_OPS=$(gcloud sql operations list --project=${var.project_id} --instance=${google_sql_database_instance.producer_sql.name} --filter="status=PENDING" --format="value(name)" 2>/dev/null || echo "")
      if [ -n "$PENDING_OPS" ]; then
        echo "Found pending operations, waiting for them to complete..."
        while [ -n "$(gcloud sql operations list --project=${var.project_id} --instance=${google_sql_database_instance.producer_sql.name} --filter="status=PENDING" --format="value(name)" 2>/dev/null)" ]; do
          echo "Still waiting for pending operations..."
          sleep 30
        done
        echo "All pending operations completed"
      fi
      
      # Enable PSC and set consumer projects in a single command
      echo "Enabling Private Service Connect and setting consumer projects..."
      CONSUMER_PROJECTS_CSV="${join(",", var.allowed_consumer_project_ids)}"
      echo "Setting PSC enabled=true and allowed projects to: $CONSUMER_PROJECTS_CSV"
      
      # Try the combined command first
      if gcloud sql instances patch ${google_sql_database_instance.producer_sql.name} \
        --project=${var.project_id} \
        --enable-private-service-connect \
        --allowed-psc-projects=$CONSUMER_PROJECTS_CSV \
        --quiet; then
        echo "Successfully enabled PSC and set consumer projects in single command"
      else
        echo "Combined command failed, trying separate commands..."
        
        # Fallback: Enable PSC first
        echo "Enabling Private Service Connect..."
        if ! gcloud sql instances patch ${google_sql_database_instance.producer_sql.name} \
          --project=${var.project_id} \
          --enable-private-service-connect \
          --quiet; then
          echo "PSC enablement failed, checking if already enabled..."
          # Check if PSC is now enabled
          NEW_PSC_STATUS=$(gcloud sql instances describe ${google_sql_database_instance.producer_sql.name} \
            --project=${var.project_id} \
            --format="value(settings.ipConfiguration.pscConfig.pscEnabled)" 2>/dev/null || echo "False")
          if [ "$NEW_PSC_STATUS" != "True" ]; then
            echo "ERROR: PSC enablement failed and PSC is still not enabled"
            exit 1
          fi
        fi
        
        # Wait a moment for PSC to be fully enabled
        echo "Waiting for PSC to be fully enabled..."
        sleep 10
        
        # Then set consumer projects
        echo "Setting allowed PSC projects..."
        if ! gcloud sql instances patch ${google_sql_database_instance.producer_sql.name} \
          --project=${var.project_id} \
          --allowed-psc-projects=$CONSUMER_PROJECTS_CSV \
          --quiet; then
          echo "ERROR: Failed to set allowed PSC projects"
          exit 1
        fi
      fi
      
      # Verify the consumer projects were set
      echo "Verifying consumer projects were set..."
      sleep 5
      FINAL_CONSUMERS=$(gcloud sql instances describe ${google_sql_database_instance.producer_sql.name} \
        --project=${var.project_id} \
        --format="value(settings.ipConfiguration.pscConfig.allowedConsumerProjects)" 2>/dev/null || echo "")
      echo "Final allowed consumers: $FINAL_CONSUMERS"
      
      if [ -z "$FINAL_CONSUMERS" ]; then
        echo "ERROR: Consumer projects verification failed - no projects found"
        exit 1
      fi
      
      echo "Private Service Connect setup completed successfully"
    EOT
  }
}

# Get the service attachment URI
data "google_sql_database_instance" "producer_sql_data" {
  name    = google_sql_database_instance.producer_sql.name
  project = var.project_id
}

# Outputs
output "instance_name" {
  description = "The name of the SQL instance"
  value       = google_sql_database_instance.producer_sql.name
}

output "instance_connection_name" {
  description = "The connection name of the SQL instance"
  value       = google_sql_database_instance.producer_sql.connection_name
}

output "private_ip_address" {
  description = "The private IP address of the SQL instance"
  value       = google_sql_database_instance.producer_sql.private_ip_address
}

output "database_name" {
  description = "The name of the database"
  value       = google_sql_database.database.name
}

output "user_name" {
  description = "The name of the database user"
  value       = google_sql_user.users.name
}

output "region" {
  description = "The region of the SQL instance"
  value       = google_sql_database_instance.producer_sql.region
}

output "project_id" {
  description = "The project ID"
  value       = var.project_id
}

output "allowed_consumer_project_ids" {
  description = "The allowed consumer project IDs"
  value       = var.allowed_consumer_project_ids
}

output "service_attachment_uri" {
  description = "The service attachment URI for Private Service Connect"
  value       = "projects/${var.project_id}/regions/${var.region}/serviceAttachments/${google_sql_database_instance.producer_sql.name}-psc"
} 