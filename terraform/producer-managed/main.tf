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
    create = "10m"
    update = "10m"
    delete = "10m"
  }
}

# Enable required APIs (depends on Cloud Resource Manager)
resource "google_project_service" "sql_admin" {
  project = var.project_id
  service = "sqladmin.googleapis.com"
  
  disable_dependent_services = true
  disable_on_destroy         = false
  
  depends_on = [
    google_project_service.cloud_resource_manager
  ]

  timeouts {
    create = "10m"
    update = "10m"
    delete = "10m"
  }
}

resource "google_project_service" "compute_engine" {
  project = var.project_id
  service = "compute.googleapis.com"
  
  disable_dependent_services = true
  disable_on_destroy         = false
  
  depends_on = [
    google_project_service.cloud_resource_manager
  ]

  timeouts {
    create = "10m"
    update = "10m"
    delete = "10m"
  }
}

resource "google_project_service" "service_networking" {
  project = var.project_id
  service = "servicenetworking.googleapis.com"
  
  disable_dependent_services = true
  disable_on_destroy         = false
  
  depends_on = [
    google_project_service.cloud_resource_manager
  ]

  timeouts {
    create = "10m"
    update = "10m"
    delete = "10m"
  }
}

# Create VPC (depends on Compute Engine API)
resource "google_compute_network" "producer_vpc" {
  name                    = "producer-vpc"
  auto_create_subnetworks = false
  
  depends_on = [
    google_project_service.compute_engine
  ]
}

# Create subnet
resource "google_compute_subnetwork" "producer_subnet" {
  name          = "producer-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.producer_vpc.id
  
  depends_on = [
    google_compute_network.producer_vpc
  ]
}

# Create default firewall rules
resource "google_compute_firewall" "default_allow_internal" {
  name    = "producer-allow-internal"
  network = google_compute_network.producer_vpc.name
  
  allow {
    protocol = "tcp"
  }
  allow {
    protocol = "udp"
  }
  allow {
    protocol = "icmp"
  }
  
  source_ranges = ["10.0.0.0/8"]
  
  depends_on = [
    google_compute_network.producer_vpc
  ]
}

resource "google_compute_firewall" "default_allow_ssh" {
  name    = "producer-allow-ssh"
  network = google_compute_network.producer_vpc.name
  
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
  
  source_ranges = ["0.0.0.0/0"]
  
  depends_on = [
    google_compute_network.producer_vpc
  ]
}

# Allocate IP range for Private Service Access
resource "google_compute_global_address" "psc_ip_range" {
  name          = "psc-ip-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.producer_vpc.id
  
  depends_on = [
    google_compute_network.producer_vpc,
    google_project_service.service_networking
  ]
}

# Create Private Service Connection (commented out due to permission requirements)
# Uncomment after granting Service Networking Admin role to service account
# resource "google_service_networking_connection" "psc_connection" {
#   network                 = google_compute_network.producer_vpc.id
#   service                 = "servicenetworking.googleapis.com"
#   reserved_peering_ranges = [google_compute_global_address.psc_ip_range.name]
#   
#   depends_on = [
#     google_compute_global_address.psc_ip_range,
#     google_project_service.service_networking
#   ]
# }

# Outputs
output "vpc_name" {
  description = "The name of the created VPC"
  value       = google_compute_network.producer_vpc.name
}

output "subnet_name" {
  description = "The name of the created subnet"
  value       = google_compute_subnetwork.producer_subnet.name
}

output "psc_ip_range" {
  description = "The allocated IP range for Private Service Access"
  value       = google_compute_global_address.psc_ip_range.address
}

output "psc_ip_range_name" {
  description = "The name of the allocated IP range for Private Service Access"
  value       = google_compute_global_address.psc_ip_range.name
}

output "vpc_self_link" {
  description = "The self-link of the created VPC"
  value       = google_compute_network.producer_vpc.self_link
}

output "subnet_self_link" {
  description = "The self-link of the created subnet"
  value       = google_compute_subnetwork.producer_subnet.self_link
} 