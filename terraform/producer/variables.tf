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

variable "subnet_cidr_range" {
  description = "CIDR range for the producer subnet"
  type        = string
  default     = "10.0.0.0/24"
}

variable "internal_firewall_source_ranges" {
  description = "Source IP ranges for internal firewall rules"
  type        = list(string)
  default     = ["10.0.0.0/8"]
}

variable "psc_ip_range_prefix_length" {
  description = "Prefix length for the PSC IP range"
  type        = number
  default     = 16
} 