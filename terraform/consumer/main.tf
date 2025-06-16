terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.1.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Reserve internal IP address for PSC endpoint
resource "google_compute_address" "psc_reserved_ip" {
  name         = var.reserved_ip_name
  purpose      = "GCE_ENDPOINT"
  address_type = "INTERNAL"
  subnetwork   = var.subnet_name
  region       = var.region
}

# Create PSC forwarding rule (PSC endpoint)
resource "google_compute_forwarding_rule" "psc_endpoint" {
  name                  = var.psc_endpoint_name
  region                = var.region
  network               = var.vpc_name
  subnetwork            = var.subnet_name
  ip_address            = google_compute_address.psc_reserved_ip.id
  target                = var.service_attachment_uri
  load_balancing_scheme = ""
}