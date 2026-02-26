variable "environment" {
  type = string
}

variable "service_names" {
  type = list(string)
}

variable "log_retention_days" {
  type    = number
  default = 30
}
