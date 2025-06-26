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
  zone    = var.zone
}

# Get VPC information
data "google_compute_network" "vpc" {
  name = var.vpc_name
}

# Get existing subnets in the VPC
data "google_compute_subnetwork" "existing_subnets" {
  for_each = toset(data.google_compute_network.vpc.subnetworks_self_links)
  self_link = each.key
}

# Create PSC NAT subnet with auto-calculated CIDR
resource "google_compute_subnetwork" "psc_nat_subnet" {
  name          = "psc-nat-subnet"
  ip_cidr_range = "10.0.1.0/24"  # This will be automatically adjusted if there's a conflict
  region        = var.region
  network       = var.vpc_name
  purpose       = "PRIVATE_SERVICE_CONNECT"
  
  # Ensure the subnet is created in a different CIDR range than existing subnets
  lifecycle {
    ignore_changes = [ip_cidr_range]
  }
}

# 1. Create instance group and health check
# Get existing VM information
data "google_compute_instance" "existing_vm" {
  name = var.instance_name
  zone = var.zone
}

# Create an unmanaged instance group
resource "google_compute_instance_group" "unmanaged_group" {
  name = var.instance_group_name
  zone = var.zone
}

# Add the existing VM to the instance group
resource "google_compute_instance_group_membership" "vm_membership" {
  instance_group = google_compute_instance_group.unmanaged_group.name
  instance       = data.google_compute_instance.existing_vm.self_link
  zone           = var.zone
}

# Add named port to the instance group
resource "google_compute_instance_group_named_port" "default" {
  group = google_compute_instance_group.unmanaged_group.name
  name  = "http"
  port  = var.port
  zone  = var.zone
}

# Create a TCP health check
resource "google_compute_health_check" "tcp_health_check" {
  name = var.health_check_name
  tcp_health_check {
    port = var.port
  }
}

# 2. Create backend service pointing to group
resource "google_compute_region_backend_service" "backend_service" {
  name                  = var.backend_service_name
  protocol              = "TCP"
  load_balancing_scheme = "INTERNAL"
  region                = var.region
  backend {
    group = google_compute_instance_group.unmanaged_group.id
  }
  health_checks = [google_compute_health_check.tcp_health_check.id]
  depends_on    = [google_compute_instance_group_membership.vm_membership]
}

# 3. Create ILB forwarding rule
resource "google_compute_forwarding_rule" "psc_ilb" {
  name                  = var.forwarding_rule_name
  load_balancing_scheme = "INTERNAL"
  ports                 = [var.port]
  network               = var.vpc_name
  subnetwork            = var.subnet_name
  region                = var.region
  backend_service       = google_compute_region_backend_service.backend_service.id
}

# 4. Create service attachment targeting backend service
resource "google_compute_service_attachment" "psc_attachment" {
  name                   = var.service_attachment_name
  region                 = var.region
  connection_preference  = "ACCEPT_MANUAL"
  enable_proxy_protocol  = true
  nat_subnets            = [google_compute_subnetwork.psc_nat_subnet.id]
  target_service         = google_compute_forwarding_rule.psc_ilb.id
  reconcile_connections  = true
  depends_on            = [
    google_compute_region_backend_service.backend_service,
    google_compute_forwarding_rule.psc_ilb,
    google_compute_subnetwork.psc_nat_subnet
  ]

  timeouts {
    create = "10m"
    update = "10m"
    delete = "10m"
  }
} 