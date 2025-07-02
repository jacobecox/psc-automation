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

# Enable Cloud Resource Manager API first (required for other APIs)
resource "google_project_service" "cloud_resource_manager" {
  project = var.project_id
  service = "cloudresourcemanager.googleapis.com"
  
  disable_dependent_services = true
  disable_on_destroy         = false

  timeouts {
    create = "15m"
    update = "15m"
    delete = "15m"
  }
}

# Enable SQL Admin API (required for Cloud SQL operations)
resource "google_project_service" "sql_admin" {
  project = var.project_id
  service = "sqladmin.googleapis.com"
  
  disable_dependent_services = true
  disable_on_destroy         = false
  
  depends_on = [
    google_project_service.cloud_resource_manager
  ]

  timeouts {
    create = "15m"
    update = "15m"
    delete = "15m"
  }
}

# Enable Compute Engine API (depends on Cloud Resource Manager)
resource "google_project_service" "compute_engine" {
  project = var.project_id
  service = "compute.googleapis.com"
  
  disable_dependent_services = true
  disable_on_destroy         = false
  
  depends_on = [
    google_project_service.cloud_resource_manager
  ]

  timeouts {
    create = "15m"
    update = "15m"
    delete = "15m"
  }
}

# Enable Service Networking API (required for PSC)
resource "google_project_service" "service_networking" {
  project = var.project_id
  service = "servicenetworking.googleapis.com"
  
  disable_dependent_services = true
  disable_on_destroy         = false
  
  depends_on = [
    google_project_service.cloud_resource_manager
  ]

  timeouts {
    create = "15m"
    update = "15m"
    delete = "15m"
  }
}

# Outputs for API enablement status
output "apis_enabled" {
  description = "All required APIs have been enabled"
  value = {
    cloud_resource_manager = google_project_service.cloud_resource_manager.service
    sql_admin = google_project_service.sql_admin.service
    compute_engine = google_project_service.compute_engine.service
    service_networking = google_project_service.service_networking.service
  }
}

output "project_id" {
  description = "The project ID where APIs were enabled"
  value = var.project_id
} 