variable "project_id" {
  description = "The GCP project ID for the producer"
  type        = string
  default     = "test-project-2-462619"
}

variable "region" {
  description = "The region where resources will be created"
  type        = string
  default     = "us-central1"
} 