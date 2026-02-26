output "certificate_arn" {
  value = aws_acm_certificate.api.arn
}

output "waf_acl_arn" {
  value = aws_wafv2_web_acl.api.arn
}

output "cdn_domain_name" {
  value = aws_cloudfront_distribution.cdn.domain_name
}
