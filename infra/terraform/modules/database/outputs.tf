output "postgres_endpoint" {
  value = aws_db_instance.postgres.address
}

output "postgres_port" {
  value = aws_db_instance.postgres.port
}

output "redis_primary_endpoint" {
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "events_queue_url" {
  value = aws_sqs_queue.events.url
}

output "events_dlq_url" {
  value = aws_sqs_queue.events_dlq.url
}

output "object_storage_bucket" {
  value = aws_s3_bucket.objects.bucket
}
