variable "project_id" {
  description = "The project ID where the VM will be created"
  type        = string
}

variable "region" {
  description = "The region where the VM will be created"
  type        = string
}

variable "consumer_vpc_self_link" {
  description = "The self-link of the consumer VPC"
  type        = string
}

variable "vm_subnet_self_link" {
  description = "The self-link of the VM subnet"
  type        = string
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