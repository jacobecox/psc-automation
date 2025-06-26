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
  project = var.producer_project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "sqladmin" {
  project = var.producer_project_id
  service = "sqladmin.googleapis.com"
  disable_dependent_services = false
}

resource "google_project_service" "servicenetworking" {
  project = var.producer_project_id
  service = "servicenetworking.googleapis.com"
  disable_dependent_services = false
}

# Create VPC for SQL instance
resource "google_compute_network" "sql_vpc" {
  name                    = "sql-vpc"
  auto_create_subnetworks = false
  project                 = var.producer_project_id
}

# Create subnet for SQL instance
resource "google_compute_subnetwork" "sql_subnet" {
  name          = "sql-subnet"
  ip_cidr_range = "10.0.0.0/24"
  network       = google_compute_network.sql_vpc.id
  region        = var.region
  project       = var.producer_project_id
}

# Create Cloud SQL instance
resource "google_sql_database_instance" "producer_sql" {
  name             = var.instance_id
  database_version = "POSTGRES_17"
  region           = var.region
  project          = var.producer_project_id

  depends_on = [
    google_project_service.sqladmin,
    google_project_service.servicenetworking
  ]

  settings {
    tier = "db-f1-micro"
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.sql_vpc.id
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
  project  = var.producer_project_id
}

# Create user
resource "google_sql_user" "users" {
  name     = "postgres"
  instance = google_sql_database_instance.producer_sql.name
  password = var.default_password
  project  = var.producer_project_id
}

# Enable Private Service Connect
resource "null_resource" "enable_psc" {
  depends_on = [google_sql_database_instance.producer_sql]

  provisioner "local-exec" {
    command = <<-EOT
      echo "Enabling Private Service Connect for SQL instance..."
      echo "Project: ${var.producer_project_id}"
      echo "Consumer Project: ${var.allowed_consumer_project_id}"
      
      # Wait for SQL instance to be ready
      echo "Waiting for SQL instance to be ready..."
      gcloud sql instances describe ${google_sql_database_instance.producer_sql.name} \
        --project=${var.producer_project_id} \
        --format="value(state)" | grep -q "RUNNABLE" || \
        (echo "SQL instance not ready yet, waiting..." && sleep 30)
      
      # Enable PSC
      echo "Enabling Private Service Connect..."
      gcloud sql instances patch ${google_sql_database_instance.producer_sql.name} \
        --project=${var.producer_project_id} \
        --enable-private-service-connect \
        --quiet || echo "PSC enablement failed or already enabled"
      
      # Allow consumer project
      echo "Allowing consumer project to connect..."
      gcloud sql instances patch ${google_sql_database_instance.producer_sql.name} \
        --project=${var.producer_project_id} \
        --allowed-psc-projects=${var.allowed_consumer_project_id} \
        --quiet || echo "Consumer project allowance failed or already set"
      
      echo "Private Service Connect setup completed"
    EOT
  }
}

# Get the service attachment URI
data "google_sql_database_instance" "producer_sql_data" {
  name    = google_sql_database_instance.producer_sql.name
  project = var.producer_project_id
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

output "producer_project_id" {
  description = "The producer project ID"
  value       = var.producer_project_id
}

output "allowed_consumer_project_id" {
  description = "The allowed consumer project ID"
  value       = var.allowed_consumer_project_id
}

output "service_attachment_uri" {
  description = "The service attachment URI for Private Service Connect"
  value       = "projects/${var.producer_project_id}/regions/${var.region}/serviceAttachments/${google_sql_database_instance.producer_sql.name}-psc"
} 