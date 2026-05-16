mock_provider "aws" {
  override_during = plan

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
  project_name   = "OptiGrid"
  environment    = "production"
  instance_type  = "t3.micro"
  ssh_public_key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIoptigridcontractstestkey OptiGrid"
}

run "variable_and_output_contracts" {
  command = apply

  assert {
    condition     = aws_instance.optigrid_server.instance_type == var.instance_type
    error_message = "aws_instance.optigrid_server.instance_type must honor var.instance_type."
  }

  assert {
    condition     = aws_key_pair.optigrid.key_name == "optigrid-production-key"
    error_message = "Key pair naming contract changed; expected optigrid-production-key."
  }

  assert {
    condition     = aws_instance.optigrid_server.tags.Name == "OptiGrid-production-server"
    error_message = "Instance Name tag contract changed."
  }

  assert {
    condition     = length(trimspace(output.server_public_ip)) > 0
    error_message = "Output server_public_ip must be present."
  }

  assert {
    condition     = length(trimspace(output.server_public_dns)) > 0
    error_message = "Output server_public_dns must be present."
  }

  assert {
    condition     = length(trimspace(output.security_group_id)) > 0
    error_message = "Output security_group_id must be present."
  }
}
