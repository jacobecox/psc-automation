variable "project_id" {
  description = "The GCP project ID for the producer"
  type        = string
}

variable "region" {
  description = "The GCP region for the SQL instance"
  type        = string
}

variable "instance_id" {
  description = "The name of the SQL instance"
  type        = string
  default     = "producer-sql"
}

variable "default_password" {
  description = "The default password for the SQL instance"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "allowed_consumer_project_ids" {
  description = "The GCP project IDs for the consumers that will be allowed to connect"
  type        = list(string)
}

variable "tier" {
  description = "The machine type to use for the Cloud SQL instance"
  type        = string
  default     = "db-f1-micro"
}

variable "database_version" {
  description = "The database version to use for the Cloud SQL instance"
  type        = string
  default     = "POSTGRES_17"
}

variable "deletion_protection" {
  description = "Whether deletion protection is enabled for the Cloud SQL instance"
  type        = bool
  default     = false
}

variable "backup_enabled" {
  description = "Whether backup is enabled for the Cloud SQL instance"
  type        = bool
  default     = true
}

variable "backup_start_time" {
  description = "The start time for backup in HH:MM format (24-hour)"
  type        = string
  default     = "02:00"
}

variable "maintenance_day" {
  description = "The day of the week for maintenance (1=Sunday, 7=Saturday)"
  type        = number
  default     = 7
}

variable "maintenance_hour" {
  description = "The hour of the day for maintenance (0-23)"
  type        = number
  default     = 2
}

variable "maintenance_update_track" {
  description = "The update track for maintenance (stable, preview)"
  type        = string
  default     = "stable"
} 