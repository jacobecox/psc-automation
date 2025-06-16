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
  description = "The name of the subnet"
  type        = string
}

variable "instance_name" {
  description = "The name of the instance"
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

variable "topic_name" {
  description = "The name of the Pub/Sub topic"
  type        = string
}

variable "subscription_name" {
  description = "The name of the Pub/Sub subscription"
  type        = string
} 