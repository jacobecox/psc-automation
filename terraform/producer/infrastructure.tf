# Create VPC (depends on Compute Engine API being fully enabled)
resource "google_compute_network" "producer_vpc" {
  name                    = "producer-vpc"
  auto_create_subnetworks = false

  timeouts {
    create = "15m"
    update = "15m"
    delete = "15m"
  }
}

# Create subnet
resource "google_compute_subnetwork" "producer_subnet" {
  name          = "producer-subnet"
  ip_cidr_range = var.subnet_cidr_range
  region        = var.region
  network       = google_compute_network.producer_vpc.id

  timeouts {
    create = "10m"
    update = "10m"
    delete = "10m"
  }
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
  
  source_ranges = var.internal_firewall_source_ranges

  timeouts {
    create = "10m"
    update = "10m"
    delete = "10m"
  }
}

resource "google_compute_firewall" "default_allow_ssh" {
  name    = "producer-allow-ssh"
  network = google_compute_network.producer_vpc.name
  
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
  
  source_ranges = ["0.0.0.0/0"]

  timeouts {
    create = "10m"
    update = "10m"
    delete = "10m"
  }
}

# Allocate IP range for Private Service Access
resource "google_compute_global_address" "psc_ip_range" {
  name          = var.psc_ip_range_name
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = var.psc_ip_range_prefix_length
  network       = google_compute_network.producer_vpc.id

  timeouts {
    create = "10m"
    update = "10m"
    delete = "10m"
  }
}

# Create Private Service Access connection using the reserved IP range
resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.producer_vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.psc_ip_range.name]

  depends_on = [google_compute_global_address.psc_ip_range]

  timeouts {
    create = "10m"
    update = "10m"
    delete = "10m"
  }
}

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