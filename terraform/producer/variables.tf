variable "producer_project_id" {
  description = "The GCP project ID for the producer"
  type        = string
}

variable "region" {
  description = "The GCP region for the producer"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "The GCP zone for the producer"
  type        = string
  default     = "us-central1-a"
}

variable "vpc_name" {
  description = "The name of the VPC"
  type        = string
  default     = "producer-vpc"
}

variable "subnet_name" {
  description = "The name of the subnet"
  type        = string
  default     = "producer-subnet"
}

variable "instance_name" {
  description = "The name of the compute instance"
  type        = string
  default     = "producer-instance"
}

variable "port" {
  description = "The port for the service"
  type        = number
  default     = 8080
}

variable "instance_group_name" {
  description = "The name of the instance group"
  type        = string
  default     = "producer-group"
}

variable "backend_service_name" {
  description = "The name of the backend service"
  type        = string
  default     = "producer-backend"
}

variable "health_check_name" {
  description = "The name of the health check"
  type        = string
  default     = "tcp-hc"
}

variable "forwarding_rule_name" {
  description = "The name of the forwarding rule"
  type        = string
  default     = "producer-forwarding-rule"
}

variable "service_attachment_name" {
  description = "The name of the service attachment"
  type        = string
  default     = "producer-attachment"
} 