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

resource "google_pubsub_topic" "producer_topic" {
  name    = var.topic_name
  project = var.project_id
}

resource "google_pubsub_subscription" "producer_subscription" {
  name    = var.subscription_name
  topic   = google_pubsub_topic.producer_topic.name
  project = var.project_id
}

# Create an unmanaged instance group
resource "google_compute_instance_group" "unmanaged_group" {
  name = var.instance_group_name
  zone = var.zone
}

# Add named port to the instance group
resource "google_compute_instance_group_named_port" "default" {
  name           = "http"
  instance_group = google_compute_instance_group.unmanaged_group.name
  zone           = var.zone
  port           = 80
}

# Create a TCP health check
resource "google_compute_health_check" "tcp_health_check" {
  name = var.health_check_name
  tcp_health_check {
    port = 80
  }
}

# Create backend service using the instance group
resource "google_compute_region_backend_service" "backend_service" {
  name                  = var.backend_service_name
  protocol              = "TCP"
  load_balancing_scheme = "INTERNAL"
  region                = var.region
  backends = [
    {
      group = google_compute_instance_group.unmanaged_group.self_link
    }
  ]
  health_checks = [google_compute_health_check.tcp_health_check.self_link]
}

# Create forwarding rule for ILB
resource "google_compute_forwarding_rule" "psc_ilb" {
  name                  = var.forwarding_rule_name
  load_balancing_scheme = "INTERNAL"
  ports                 = ["80"]
  network               = var.vpc_name
  subnetwork            = var.subnet_name
  region                = var.region
  backend_service       = google_compute_region_backend_service.backend_service.id
}

# Create service attachment (PSC)
resource "google_compute_service_attachment" "psc_attachment" {
  name                   = var.service_attachment_name
  region                 = var.region
  connection_preference  = "ACCEPT_MANUAL"
  enable_proxy_protocol  = true
  nat_subnets            = [var.subnet_name]
  target_service         = google_compute_forwarding_rule.psc_ilb.id
} 