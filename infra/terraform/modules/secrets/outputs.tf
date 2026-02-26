output "kms_key_arn" {
  value = aws_kms_key.app.arn
}

output "secret_arn" {
  value = aws_secretsmanager_secret.app.arn
}
