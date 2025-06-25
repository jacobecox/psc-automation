variable "project_id" {
  description = "The GCP project ID for the producer"
  type        = string
  default     = "producer-test-project"
}

variable "region" {
  description = "The region where the Cloud SQL instance will be created"
  type        = string
  default     = "us-central1"
}

variable "instance_id" {
  description = "The instance ID for the Cloud SQL instance"
  type        = string
  default     = "producer-sql"
}

variable "default_password" {
  description = "The default password for the postgres user"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "allowed_consumer_project_id" {
  description = "The project ID allowed for private service connect"
  type        = string
  default     = "consumer-test-project-463821"
} 