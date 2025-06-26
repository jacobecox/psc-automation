variable "consumer_project_id" {
  description = "The consumer project ID where the VM will be created"
  type        = string
}

variable "region" {
  description = "The region where the VM will be created"
  type        = string
  default     = "us-central1"
}

variable "instance_name" {
  description = "The name of the VM instance"
  type        = string
  default     = "consumer-vm"
}

variable "machine_type" {
  description = "The machine type for the VM instance"
  type        = string
  default     = "e2-micro"
}

variable "os_image" {
  description = "The operating system image for the VM"
  type        = string
  default     = "debian-cloud/debian-12"
} 