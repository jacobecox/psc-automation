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
  name    = var.producer_vpc_name
  project = var.project_id
}

# Use existing producer subnet
data "google_compute_subnetwork" "producer_subnet" {
  name    = var.producer_subnet_name
  project = var.project_id
  region  = var.region
}

# Create Cloud SQL instance with PSC enabled
resource "google_sql_database_instance" "producer_sql" {
  name             = var.instance_id
  database_version = var.database_version
  region           = var.region
  project          = var.project_id

  settings {
    tier = var.tier
    
    availability_type = "REGIONAL"
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = data.google_compute_network.producer_vpc.id
      require_ssl     = false
      
      psc_config {
        psc_enabled               = true
        allowed_consumer_projects = var.allowed_consumer_project_ids
      }
    }

    backup_configuration {
      enabled            = var.backup_enabled
      start_time         = var.backup_start_time
    }

    maintenance_window {
      day          = var.maintenance_day
      hour         = var.maintenance_hour
      update_track = var.maintenance_update_track
    }

    deletion_protection_enabled = var.deletion_protection
  }

  deletion_protection = var.deletion_protection
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

# Data source to get instance details
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
  description = "The project ID of the SQL instance"
  value       = google_sql_database_instance.producer_sql.project
}

output "allowed_consumer_project_ids" {
  description = "The allowed consumer project IDs"
  value       = var.allowed_consumer_project_ids
}

output "service_attachment_uri" {
  description = "The service attachment URI for PSC"
  value       = data.google_sql_database_instance.producer_sql_data.psc_service_attachment_link
} 