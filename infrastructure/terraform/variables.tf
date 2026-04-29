variable "aws_region" {
  description = "AWS region where resources will be created."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "production"
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

variable "ssh_public_key" {
  description = "Public SSH key content used to create the EC2 key pair."
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH into the server."
  type        = string
  default     = "0.0.0.0/0"
}
