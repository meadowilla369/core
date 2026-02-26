output "alerts_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

output "log_group_names" {
  value = [for lg in aws_cloudwatch_log_group.services : lg.name]
}
