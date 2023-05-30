locals {
  project = "minecraft-gcp-387919"
  region  = "us-east4"
}

variable "DISCORD_PUBLIC_KEY" {
  type = string
  nullable = false
}

variable "DISCORD_APPLICATION_ID" {
  type = string
  nullable = false
}

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "4.51.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "2.3.0"
    }
  }
}

provider "google" {
  credentials = file("../service-account-key.json")

  project = local.project
  region  = local.region
  zone    = "${local.region}-b"
}

provider "archive" {
  version = "~> 2.3.0"
}

data "archive_file" "discord_interactions_source" {
  type        = "zip"
  source_dir  = "../functions"
  output_path = "../functions.zip"
}

resource "google_pubsub_topic" "minecraft-server-start" {
  name = "minecraft-server-start"
  project = local.project
}

resource "google_service_account" "discord_interactions_gcf_sa" {
  account_id   = "gcf-sa"
  display_name = "GCF SA"
}

resource "google_storage_bucket" "discord_interactions_source_bucket" {
  name                        = "${local.project}-gcf-source" # Every bucket name must be globally unique
  location                    = "US"
  uniform_bucket_level_access = true
}

resource "google_storage_bucket_object" "discord_interactions_source" {
  name   = "gcf-${data.archive_file.discord_interactions_source.output_base64sha256}.zip"
  bucket = google_storage_bucket.discord_interactions_source_bucket.name
  source = data.archive_file.discord_interactions_source.output_path
}

resource "google_compute_instance_iam_binding" "discord_interaction_access" {
  project       = local.project
  zone          = "${local.region}-b"
  instance_name = google_compute_instance.mc_server.name
  role          = "roles/compute.admin"
  members = [
    "serviceAccount:${google_service_account.discord_interactions_gcf_sa.email}"
  ]
  depends_on = [google_service_account.discord_interactions_gcf_sa, google_compute_instance.mc_server]
}

resource "google_pubsub_topic_iam_binding" "gcf_access" {
  project = local.project
  topic   = google_pubsub_topic.minecraft-server-start.name
  role    = "roles/pubsub.admin"
  members = [
    "serviceAccount:${google_service_account.discord_interactions_gcf_sa.email}"
  ]
  depends_on = [google_service_account.discord_interactions_gcf_sa, google_pubsub_topic.minecraft-server-start]
}

// TODO: create firewall rule for minecraft
// TODO: setup disk for minecraft??
// TODO: delete service account because i accidently committed it
resource "google_compute_instance" "mc_server" {
  name         = "mc-server"
  machine_type = "e2-standard-2"
  zone         = "${local.region}-b"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network = "default"

    access_config {
      // Ephemeral IP
    }
  }

  metadata_startup_script = file("../compute/mc/start.sh")
  scheduling {
    preemptible        = true
    automatic_restart  = false
    provisioning_model = "SPOT"
  }
}

// TODO: figure out how to make google cloud functions a public endpoint (its needs to be done through cloud run but I don't know how to do that)
resource "google_cloudfunctions2_function" "discord_interactions_functions" {
  name        = "discordinteractions"
  description = "Discord Interactions Handler"
  location    = local.region

  build_config {
    runtime     = "nodejs18"
    entry_point = "interactions"
    source {
      storage_source {
        bucket = google_storage_bucket.discord_interactions_source_bucket.name
        object = google_storage_bucket_object.discord_interactions_source.name
      }
    }
  }

  service_config {
    max_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 60

    environment_variables = {
      GCP_PROJECT_ID         = local.project,
      GCE_ZONE               = "${local.region}-b",
      GCE_INSTANCE_NAME      = google_compute_instance.mc_server.name,
      GCPUB_START_TOPIC      = google_pubsub_topic.minecraft-server-start.name,
      DISCORD_PUBLIC_KEY     = var.DISCORD_PUBLIC_KEY,
      DISCORD_APPLICATION_ID = var.DISCORD_APPLICATION_ID
    }

    service_account_email = google_service_account.discord_interactions_gcf_sa.email
  }

  depends_on = [google_compute_instance.mc_server, google_pubsub_topic.minecraft-server-start]
}

resource "google_cloudfunctions2_function" "start_server" {
  name        = "startserver"
  description = "Start Server Event Handler"
  location    = local.region
  build_config {
    runtime     = "nodejs18"
    entry_point = "minecraft-server-start"
    source {
      storage_source {
        bucket = google_storage_bucket.discord_interactions_source_bucket.name
        object = google_storage_bucket_object.discord_interactions_source.name
      }
    }
  }

  service_config {
    max_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 60

    environment_variables = {
      GCP_PROJECT_ID         = local.project,
      GCE_ZONE               = "${local.region}-b",
      GCE_INSTANCE_NAME      = google_compute_instance.mc_server.name,
      GCPUB_START_TOPIC      = google_pubsub_topic.minecraft-server-start.name,
      DISCORD_PUBLIC_KEY     = var.DISCORD_PUBLIC_KEY,
      DISCORD_APPLICATION_ID = var.DISCORD_APPLICATION_ID
    }

    ingress_settings = "ALLOW_INTERNAL_ONLY"
    all_traffic_on_latest_revision = true

    service_account_email = google_service_account.discord_interactions_gcf_sa.email
  }

  event_trigger {
    trigger_region = local.region
    event_type = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic = google_pubsub_topic.minecraft-server-start.id
    retry_policy = "RETRY_POLICY_DO_NOT_RETRY"
  }

  depends_on = [google_compute_instance.mc_server, google_pubsub_topic.minecraft-server-start, google_pubsub_topic_iam_binding.gcf_access]
}

output "interactions_endpoint_url" {
  value = google_cloudfunctions2_function.discord_interactions_functions.service_config[0].uri
}
