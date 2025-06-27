variable "project_id" {
  description = "The GCP project ID for the consumer"
  type        = string
}

variable "region" {
  description = "The region where resources will be created"
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

variable "reserved_ip_name" {
  description = "The name for the reserved IP address"
  type        = string
  default     = "psc-reserved-ip"
}

variable "psc_endpoint_name" {
  description = "The name for the PSC endpoint"
  type        = string
}

variable "service_attachment_uri" {
  description = "The URI of the service attachment provided by the producer"
  type        = string
}