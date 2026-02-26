terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "network" {
  source = "../../modules/network"

  environment          = var.environment
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

module "database" {
  source = "../../modules/database"

  environment                = var.environment
  private_subnet_ids         = module.network.private_subnet_ids
  db_security_group_id       = module.network.db_security_group_id
  postgres_username          = var.postgres_username
  postgres_password          = var.postgres_password
  postgres_db_name           = var.postgres_db_name
  object_storage_bucket_name = var.object_storage_bucket_name
}

module "observability" {
  source = "../../modules/observability"

  environment   = var.environment
  service_names = var.service_names
}

module "edge" {
  source = "../../modules/edge"

  environment       = var.environment
  domain_name       = var.domain_name
  api_origin_domain = var.api_origin_domain
}

module "secrets" {
  source = "../../modules/secrets"

  environment            = var.environment
  initial_secret_payload = var.initial_secret_payload
}
