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
  project_name     = "OptiGrid"
  environment      = "pr-123"
  instance_type    = "t3.medium"
  allowed_ssh_cidr = "203.0.113.10/32"
  ssh_public_key   = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIoptigridpreviewtestkey OptiGrid"
}

run "preview_environment_naming_contracts" {
  command = plan

  assert {
    condition     = output.environment == "pr-123"
    error_message = "Preview environment output must expose the normalized PR environment name."
  }

  assert {
    condition     = output.resource_name_prefix == "optigrid-pr-123"
    error_message = "Preview resource name prefix must isolate PR resources."
  }

  assert {
    condition     = aws_key_pair.optigrid.key_name == "optigrid-pr-123-key"
    error_message = "Preview key pair name must include the PR environment."
  }

  assert {
    condition     = aws_security_group.optigrid_server.name == "optigrid-pr-123-sg"
    error_message = "Preview security group name must include the PR environment."
  }

  assert {
    condition     = aws_instance.optigrid_server.tags.Name == "OptiGrid-pr-123-server"
    error_message = "Preview instance Name tag must include the PR environment."
  }

  assert {
    condition     = aws_instance.optigrid_server.tags.Environment == "pr-123"
    error_message = "Preview instance Environment tag must include the PR environment."
  }

  assert {
    condition     = aws_instance.optigrid_server.tags.Role == "pr-preview"
    error_message = "PR preview instance Role tag must identify preview infrastructure."
  }
}
