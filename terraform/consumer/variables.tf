variable "project_id" {
  description = "The GCP project ID for the consumer"
  type        = string
}

variable "region" {
  description = "The region where resources will be created"
  type        = string
}

variable "consumer_vpc_name" {
  description = "The name of the consumer VPC"
  type        = string
  default     = "consumer-vpc"
}

variable "vm_subnet_name" {
  description = "The name of the VM subnet"
  type        = string
  default     = "vm-subnet"
}

variable "psc_subnet_name" {
  description = "The name of the PSC subnet"
  type        = string
  default     = "psc-subnet"
}

variable "psc_endpoint_name" {
  description = "The name for the PSC endpoint"
  type        = string
  default     = "psc-endpoint"
}

variable "service_attachment_uri" {
  description = "The URI of the service attachment provided by the producer"
  type        = string
}

variable "vm_subnet_cidr_range" {
  description = "CIDR range for the VM subnet"
  type        = string
  default     = "10.1.0.0/24"
}

variable "psc_subnet_cidr_range" {
  description = "CIDR range for the PSC subnet"
  type        = string
  default     = "10.2.0.0/24"
}

variable "internal_firewall_source_ranges" {
  description = "Source IP ranges for internal firewall rules"
  type        = list(string)
  default     = ["10.0.0.0/8"]
}

variable "postgres_egress_destination_ranges" {
  description = "Destination IP ranges for PostgreSQL egress firewall rule"
  type        = list(string)
  default     = ["10.0.0.0/8"]
}