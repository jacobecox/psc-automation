# Create VPC (depends on Compute Engine API being fully enabled)
resource "google_compute_network" "consumer_vpc" {
  name                    = var.consumer_vpc_name
  auto_create_subnetworks = false

  timeouts {
    create = "15m"
    update = "15m"
    delete = "15m"
  }
}

# Create VM subnet
resource "google_compute_subnetwork" "vm_subnet" {
  name          = var.vm_subnet_name
  ip_cidr_range = var.vm_subnet_cidr_range
  region        = var.region
  network       = google_compute_network.consumer_vpc.id

  timeouts {
    create = "10m"
    update = "10m"
    delete = "10m"
  }
}

# Create PSC subnet
resource "google_compute_subnetwork" "psc_subnet" {
  name          = var.psc_subnet_name
  ip_cidr_range = var.psc_subnet_cidr_range
  region        = var.region
  network       = google_compute_network.consumer_vpc.id

  timeouts {
    create = "10m"
    update = "10m"
    delete = "10m"
  }
}

# Create default firewall rules
resource "google_compute_firewall" "default_allow_internal" {
  name    = "consumer-allow-internal"
  network = google_compute_network.consumer_vpc.name
  
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
  name    = "consumer-allow-ssh"
  network = google_compute_network.consumer_vpc.name
  
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

# Allow egress to PostgreSQL on port 5432
resource "google_compute_firewall" "allow_postgres_egress" {
  name    = "consumer-allow-postgres-egress"
  network = google_compute_network.consumer_vpc.name
  direction = "EGRESS"
  
  allow {
    protocol = "tcp"
    ports    = ["5432"]
  }
  
  destination_ranges = var.postgres_egress_destination_ranges

  timeouts {
    create = "10m"
    update = "10m"
    delete = "10m"
  }
}

# Create Cloud Router
resource "google_compute_router" "nat_router" {
  name    = "nat-router"
  region  = var.region
  network = google_compute_network.consumer_vpc.id

  timeouts {
    create = "10m"
    update = "10m"
    delete = "10m"
  }
}

# Create Cloud NAT
resource "google_compute_router_nat" "nat" {
  name                               = "consumer-nat"
  router                            = google_compute_router.nat_router.name
  region                            = var.region
  nat_ip_allocate_option            = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"
  
  # Only expose NAT to the vm-subnet, not the psc-subnet
  subnetwork {
    name                    = google_compute_subnetwork.vm_subnet.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }
  
  # Enable logging for monitoring
  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }

  timeouts {
    create = "10m"
    update = "10m"
    delete = "10m"
  }
}

# Reserve static IP address in the PSC subnet
resource "google_compute_address" "psc_ip" {
  name         = "psc-ip"
  purpose      = "GCE_ENDPOINT"
  address_type = "INTERNAL"
  subnetwork   = google_compute_subnetwork.psc_subnet.id
  region       = var.region

  timeouts {
    create = "10m"
    delete = "10m"
  }
}

# Create forwarding rule (private service connect endpoint)
resource "google_compute_forwarding_rule" "psc_endpoint" {
  name                  = var.psc_endpoint_name
  region                = var.region
  network               = google_compute_network.consumer_vpc.id
  subnetwork            = google_compute_subnetwork.psc_subnet.id
  ip_address            = google_compute_address.psc_ip.id
  target                = var.service_attachment_uri
  load_balancing_scheme = ""

  timeouts {
    create = "10m"
    update = "10m"
    delete = "10m"
  }
}

# Outputs
output "vpc_name" {
  description = "The name of the consumer VPC"
  value       = google_compute_network.consumer_vpc.name
}

output "vm_subnet_name" {
  description = "The name of the VM subnet"
  value       = google_compute_subnetwork.vm_subnet.name
}

output "psc_subnet_name" {
  description = "The name of the PSC subnet"
  value       = google_compute_subnetwork.psc_subnet.name
}

output "vpc_self_link" {
  description = "The self link of the consumer VPC"
  value       = google_compute_network.consumer_vpc.self_link
}

output "vm_subnet_self_link" {
  description = "The self link of the VM subnet"
  value       = google_compute_subnetwork.vm_subnet.self_link
}

output "psc_subnet_self_link" {
  description = "The self link of the PSC subnet"
  value       = google_compute_subnetwork.psc_subnet.self_link
}

output "psc_ip_address" {
  description = "The reserved IP address for the PSC endpoint"
  value       = google_compute_address.psc_ip.address
}

output "psc_endpoint_name" {
  description = "The name of the PSC endpoint"
  value       = google_compute_forwarding_rule.psc_endpoint.name
}

output "service_attachment_uri" {
  description = "The service attachment URI that was connected to"
  value       = var.service_attachment_uri
}

output "region" {
  description = "The region where resources were created"
  value       = var.region
} 