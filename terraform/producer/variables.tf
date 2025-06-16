variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The region where resources will be created"
  type        = string
}

variable "zone" {
  description = "The zone where the instance group will be created"
  type        = string
}

variable "vpc_name" {
  description = "The name of the VPC network"
  type        = string
}

variable "subnet_name" {
  description = "The name of the subnet for the instance group"
  type        = string
}

variable "instance_name" {
  description = "The name of the existing VM to add to the instance group"
  type        = string
}

variable "instance_group_name" {
  description = "The name of the instance group"
  type        = string
}

variable "backend_service_name" {
  description = "The name of the backend service"
  type        = string
}

variable "health_check_name" {
  description = "The name of the health check"
  type        = string
}

variable "forwarding_rule_name" {
  description = "The name of the forwarding rule"
  type        = string
}

variable "service_attachment_name" {
  description = "The name of the service attachment"
  type        = string
}

variable "port" {
  description = "The port number for the service (80 for HTTP, 5432 for PostgreSQL)"
  type        = number
  default     = 80
} 