variable "environment" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "db_security_group_id" {
  type = string
}

variable "postgres_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "postgres_allocated_storage" {
  type    = number
  default = 100
}

variable "postgres_backup_retention_days" {
  type    = number
  default = 14
}

variable "postgres_username" {
  type      = string
  sensitive = true
}

variable "postgres_password" {
  type      = string
  sensitive = true
}

variable "postgres_db_name" {
  type    = string
  default = "ticket_platform"
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.small"
}

variable "object_storage_bucket_name" {
  type = string
}
