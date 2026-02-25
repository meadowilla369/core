# Terraform Layout

- envs/dev
- envs/staging
- envs/prod
- modules/network
- modules/database
- modules/observability

Each environment should compose shared modules with environment-specific variables.
