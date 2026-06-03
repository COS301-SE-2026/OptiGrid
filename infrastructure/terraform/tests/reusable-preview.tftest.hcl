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
  project_name         = "OptiGrid"
  environment          = "preview"
  instance_type        = "t3.medium"
  root_volume_size_gb  = 60
  allowed_ssh_cidr     = "203.0.113.10/32"
  ssh_public_key       = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIoptigridreusablepreviewtestkey OptiGrid"
}

run "reusable_preview_server_contracts" {
  command = plan

  assert {
    condition     = output.environment == "preview"
    error_message = "Reusable preview output must expose the preview environment."
  }

  assert {
    condition     = output.resource_name_prefix == "optigrid-preview"
    error_message = "Reusable preview resource prefix must be stable."
  }

  assert {
    condition     = output.server_name == "OptiGrid-preview-server"
    error_message = "Reusable preview server name must be stable."
  }

  assert {
    condition     = output.server_role == "pr-preview"
    error_message = "Reusable preview server role output must identify PR preview infrastructure."
  }

  assert {
    condition     = aws_instance.optigrid_server.tags.Role == "pr-preview"
    error_message = "Reusable preview instance Role tag must identify PR preview infrastructure."
  }

  assert {
    condition     = aws_key_pair.optigrid.tags.Role == "pr-preview"
    error_message = "Reusable preview key pair Role tag must identify PR preview infrastructure."
  }

  assert {
    condition     = aws_security_group.optigrid_server.tags.Role == "pr-preview"
    error_message = "Reusable preview security group Role tag must identify PR preview infrastructure."
  }

  assert {
    condition     = aws_instance.optigrid_server.root_block_device[0].volume_size == 60
    error_message = "Reusable preview server must honor larger root volume size for Docker cache."
  }
}
