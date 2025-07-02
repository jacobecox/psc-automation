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

# Create VM instance in the consumer VPC
resource "google_compute_instance" "consumer_vm" {
  name         = var.instance_name
  machine_type = var.machine_type
  zone         = "${var.region}-a"

  boot_disk {
    initialize_params {
      image = var.os_image
      size  = 20
    }
  }

  network_interface {
    subnetwork = "projects/${var.project_id}/regions/${var.region}/subnetworks/${var.vm_subnet_name}"
    
    # No external IP - VM will use Cloud NAT for internet access
  }

  # Startup script to install required packages
  metadata_startup_script = <<-EOF
    #!/bin/bash
    apt-get update -y
    
    # Install PostgreSQL client
    apt-get install -y postgresql-client
    
    # Install ping
    apt-get install -y iputils-ping
    
    # Install telnet
    apt-get install -y telnet
    
    # Create a log file to track installation
    echo "VM startup script completed at $(date)" > /var/log/vm-startup.log
  EOF

  # Allow stopping for update
  allow_stopping_for_update = true

  timeouts {
    create = "10m"
    update = "10m"
    delete = "10m"
  }
}

# Outputs
output "instance_name" {
  description = "The name of the VM instance"
  value       = google_compute_instance.consumer_vm.name
}

output "instance_id" {
  description = "The ID of the VM instance"
  value       = google_compute_instance.consumer_vm.instance_id
}

output "zone" {
  description = "The zone where the VM is located"
  value       = google_compute_instance.consumer_vm.zone
}

output "internal_ip" {
  description = "The internal IP address of the VM"
  value       = google_compute_instance.consumer_vm.network_interface[0].network_ip
}

output "subnet_name" {
  description = "The subnet where the VM is located"
  value       = var.vm_subnet_name
}

output "vpc_name" {
  description = "The VPC where the VM is located"
  value       = var.consumer_vpc_name
}

output "project_id" {
  description = "The project ID"
  value       = var.project_id
}

output "region" {
  description = "The region where the VM is located"
  value       = var.region
}

output "machine_type" {
  description = "The machine type of the VM"
  value       = google_compute_instance.consumer_vm.machine_type
}

output "os_image" {
  description = "The OS image used for the VM"
  value       = google_compute_instance.consumer_vm.boot_disk[0].initialize_params[0].image
} 