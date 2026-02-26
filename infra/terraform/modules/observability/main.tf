terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

resource "aws_sns_topic" "alerts" {
  name = "${var.environment}-ticket-alerts"
}

resource "aws_cloudwatch_log_group" "services" {
  for_each = toset(var.service_names)

  name              = "/ticket-platform/${var.environment}/${each.value}"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_metric_alarm" "gateway_5xx" {
  alarm_name          = "${var.environment}-gateway-5xx-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "High 5xx rate detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "gateway_latency_p95" {
  alarm_name          = "${var.environment}-gateway-latency-p95"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = 300
  extended_statistic  = "p95"
  threshold           = 1500
  alarm_description   = "Gateway p95 latency above threshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
