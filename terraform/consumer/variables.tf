variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
}

variable "subnet_name" {
  description = "The name of the subnet for PSC endpoint"
  type        = string
}

variable "vpc_name" {
  description = "The name of the VPC network"
  type        = string
}

variable "psc_ip_address" {
  description = "The IP address for the PSC endpoint (e.g., '10.20.0.50')"
  type        = string
}

variable "reserved_ip_name" {
  description = "The name for the reserved IP address"
  type        = string
}

variable "psc_endpoint_name" {
  description = "The name for the PSC endpoint"
  type        = string
}

variable "service_attachment_uri" {
  description = "The URI of the service attachment provided by the producer"
  type        = string
}