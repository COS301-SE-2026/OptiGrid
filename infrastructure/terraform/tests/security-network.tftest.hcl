mock_provider "aws" {
  override_during = plan

  mock_data "aws_vpc" {
    defaults = {
      id = "vpc-12345678"
    }
  }

  mock_data "aws_subnets" {
    defaults = {
      ids = ["subnet-12345678"]
    }
  }

  mock_data "aws_ssm_parameter" {
    defaults = {
      value = "ami-0123456789abcdef0"
    }
  }
}

variables {
  allowed_ssh_cidr = "0.0.0.0/0"
  ssh_public_key   = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIoptigridsecuritytestkey OptiGrid"
}

run "security_group_and_network_contracts" {
  command = plan

  assert {
    condition     = length(aws_security_group.optigrid_server.ingress) == 3
    error_message = "Security group must define exactly three ingress rules (SSH, HTTP, HTTPS)."
  }

  assert {
    condition = anytrue([
      for rule in aws_security_group.optigrid_server.ingress :
      rule.from_port == 22 && rule.to_port == 22 && rule.protocol == "tcp" && contains(rule.cidr_blocks, var.allowed_ssh_cidr)
    ])
    error_message = "Missing SSH ingress rule matching var.allowed_ssh_cidr."
  }

  assert {
    condition = anytrue([
      for rule in aws_security_group.optigrid_server.ingress :
      rule.from_port == 80 && rule.to_port == 80 && rule.protocol == "tcp" && contains(rule.cidr_blocks, "0.0.0.0/0")
    ])
    error_message = "Missing HTTP ingress rule on port 80 from 0.0.0.0/0."
  }

  assert {
    condition = anytrue([
      for rule in aws_security_group.optigrid_server.ingress :
      rule.from_port == 443 && rule.to_port == 443 && rule.protocol == "tcp" && contains(rule.cidr_blocks, "0.0.0.0/0")
    ])
    error_message = "Missing HTTPS ingress rule on port 443 from 0.0.0.0/0."
  }

  assert {
    condition     = length(aws_security_group.optigrid_server.egress) == 1
    error_message = "Security group must define a single default egress rule."
  }

  assert {
    condition = anytrue([
      for rule in aws_security_group.optigrid_server.egress :
      rule.from_port == 0 && rule.to_port == 0 && rule.protocol == "-1" && contains(rule.cidr_blocks, "0.0.0.0/0")
    ])
    error_message = "Default egress contract changed; expected allow-all outbound traffic."
  }

  assert {
    condition     = aws_instance.optigrid_server.subnet_id == data.aws_subnets.default_vpc_subnets.ids[0]
    error_message = "EC2 subnet_id must be sourced from data.aws_subnets.default_vpc_subnets."
  }

  assert {
    condition     = aws_security_group.optigrid_server.vpc_id == data.aws_vpc.default.id
    error_message = "Security group vpc_id must be sourced from the default VPC data source."
  }
}
