# Terraform Layout

- `envs/dev`
- `envs/staging`
- `envs/prod`
- `modules/network`
- `modules/database`
- `modules/observability`
- `modules/edge`
- `modules/secrets`

## Provisioning Scope

Current IaC covers:

- VPC, public/private subnets, NAT, route tables, security groups.
- PostgreSQL 15, Redis, SQS queue, and S3 object storage.
- API edge stack: ACM certificate, WAF ACL, CloudFront distribution.
- Observability baseline: CloudWatch log groups, alarms, SNS alert topic.
- KMS + Secrets Manager baseline with key rotation enabled.

## Usage

```bash
cd infra/terraform/envs/dev
terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

Repeat for `staging` and `prod` with environment-specific `terraform.tfvars`.
