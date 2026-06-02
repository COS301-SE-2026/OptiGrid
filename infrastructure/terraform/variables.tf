variable "aws_region" {
  description = "AWS region where resources will be created."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name. Use production for the shared server or pr-<number> for isolated PR previews."
  type        = string
  default     = "production"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{0,47}$", var.environment))
    error_message = "environment must be 1-48 lowercase letters, numbers, or hyphens, and must start with a letter or number."
  }
}

variable "project_name" {
  description = "Project tag/name prefix."
  type        = string
  default     = "OptiGrid"
}

variable "instance_type" {
  description = "EC2 instance type for the server (~4GB RAM recommended)."
  type        = string
  default     = "t3.medium"
}

variable "root_volume_size_gb" {
  description = "Root EBS volume size in GB."
  type        = number
  default     = 20
}

variable "ssh_public_key" {
  description = "Public SSH key content used to create the EC2 key pair."
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH into the server."
  type        = string
  default     = "0.0.0.0/0"
}
