variable "project_id" {
  description = "The GCP project ID for the producer"
  type        = string
}
 
variable "region" {
  description = "The region where resources will be created"
  type        = string
}

variable "psc_ip_range_name" {
  description = "The name for the PSA IP range (defaults to psc-ip-range)"
  type        = string
  default     = "psc-ip-range"
} 