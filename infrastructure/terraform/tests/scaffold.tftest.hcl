mock_provider "aws" {
  override_during = plan

  mock_data "aws_subnets" {
    defaults = {
      ids = ["subnet-12345678"]
    }
  }
}

variables {
  ssh_public_key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIoptigridscaffoldtestkey OptiGrid"
}

run "scaffold_plan" {
  command = plan

  assert {
    condition     = length(trimspace(var.ssh_public_key)) > 0
    error_message = "Expected test input ssh_public_key to be non-empty."
  }
}
