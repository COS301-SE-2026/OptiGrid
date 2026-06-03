locals {
  environment_name       = lower(var.environment)
  is_preview_environment = local.environment_name == "preview" || startswith(local.environment_name, "pr-")
  resource_prefix        = "${lower(var.project_name)}-${local.environment_name}"
  server_name            = "${var.project_name}-${local.environment_name}-server"
  server_role            = local.is_preview_environment ? "pr-preview" : "app-server"
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default_vpc_subnets" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_ssm_parameter" "ubuntu_ami" {
  name = "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
}

resource "aws_key_pair" "optigrid" {
  key_name   = "${local.resource_prefix}-key"
  public_key = var.ssh_public_key

  tags = {
    Project     = var.project_name
    Environment = local.environment_name
    ManagedBy   = "Terraform"
    Role        = local.server_role
  }
}

resource "aws_security_group" "optigrid_server" {
  name        = "${local.resource_prefix}-sg"
  description = "Security group for OptiGrid ${local.environment_name} server"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Dev frontend"
    from_port   = 3001
    to_port     = 3001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Dev core health/api"
    from_port   = 4001
    to_port     = 4001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Project     = var.project_name
    Environment = local.environment_name
    ManagedBy   = "Terraform"
    Role        = local.server_role
  }
}

resource "aws_instance" "optigrid_server" {
  ami                    = data.aws_ssm_parameter.ubuntu_ami.value
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnets.default_vpc_subnets.ids[0]
  vpc_security_group_ids = [aws_security_group.optigrid_server.id]
  key_name               = aws_key_pair.optigrid.key_name
  user_data              = file("${path.module}/docker-user-data.sh")

  root_block_device {
    volume_size = var.root_volume_size_gb
    volume_type = "gp3"
  }

  tags = {
    Name        = local.server_name
    Project     = var.project_name
    Environment = local.environment_name
    ManagedBy   = "Terraform"
    Role        = local.server_role
  }
}
