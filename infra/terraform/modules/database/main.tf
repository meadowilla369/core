terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

resource "aws_db_subnet_group" "postgres" {
  name       = "${var.environment}-postgres-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "${var.environment}-postgres-subnet-group"
    Environment = var.environment
  }
}

resource "aws_db_instance" "postgres" {
  identifier              = "${var.environment}-ticket-postgres"
  engine                  = "postgres"
  engine_version          = "15.7"
  instance_class          = var.postgres_instance_class
  allocated_storage       = var.postgres_allocated_storage
  storage_encrypted       = true
  db_subnet_group_name    = aws_db_subnet_group.postgres.name
  vpc_security_group_ids  = [var.db_security_group_id]
  username                = var.postgres_username
  password                = var.postgres_password
  db_name                 = var.postgres_db_name
  backup_retention_period = var.postgres_backup_retention_days
  skip_final_snapshot     = false
  final_snapshot_identifier = "${var.environment}-ticket-postgres-final"
  deletion_protection     = true

  tags = {
    Name        = "${var.environment}-ticket-postgres"
    Environment = var.environment
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.environment}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.environment}-ticket-redis"
  description                = "Redis cache for ${var.environment}"
  node_type                  = var.redis_node_type
  num_cache_clusters         = 1
  automatic_failover_enabled = false
  engine                     = "redis"
  engine_version             = "7.1"
  parameter_group_name       = "default.redis7"
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [var.db_security_group_id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
}

resource "aws_sqs_queue" "events" {
  name                      = "${var.environment}-ticket-events"
  message_retention_seconds = 345600
}

resource "aws_sqs_queue" "events_dlq" {
  name                      = "${var.environment}-ticket-events-dlq"
  message_retention_seconds = 1209600
}

resource "aws_s3_bucket" "objects" {
  bucket = var.object_storage_bucket_name

  tags = {
    Name        = var.object_storage_bucket_name
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "objects" {
  bucket = aws_s3_bucket.objects.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "objects" {
  bucket = aws_s3_bucket.objects.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
