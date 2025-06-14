terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_pubsub_topic" "producer_topic" {
  name    = var.topic_name
  project = var.project_id
}

resource "google_pubsub_subscription" "producer_subscription" {
  name    = var.subscription_name
  topic   = google_pubsub_topic.producer_topic.name
  project = var.project_id
} 