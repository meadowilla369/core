terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

resource "aws_kms_key" "app" {
  description             = "${var.environment} ticket platform key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "app" {
  name          = "alias/${var.environment}-ticket-platform"
  target_key_id = aws_kms_key.app.key_id
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.environment}/ticket-platform/app"
  kms_key_id              = aws_kms_key.app.arn
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id     = aws_secretsmanager_secret.app.id
  secret_string = jsonencode(var.initial_secret_payload)
}
