output "environment" {
  description = "Normalized deployment environment name."
  value       = local.environment_name
}

output "resource_name_prefix" {
  description = "Prefix applied to named AWS resources for this deployment."
  value       = local.resource_prefix
}

output "server_name" {
  description = "Name tag assigned to the OptiGrid EC2 server."
  value       = local.server_name
}

output "server_role" {
  description = "Role tag assigned to the OptiGrid EC2 server."
  value       = local.server_role
}

output "key_pair_name" {
  description = "AWS key pair name for this deployment."
  value       = aws_key_pair.optigrid.key_name
}

output "server_instance_id" {
  description = "EC2 instance ID for start/stop automation."
  value       = aws_instance.optigrid_server.id
}

output "server_instance_state" {
  description = "Current EC2 instance state known to Terraform."
  value       = aws_instance.optigrid_server.instance_state
}

output "server_public_ip" {
  description = "Public IPv4 address of the OptiGrid server."
  value       = aws_instance.optigrid_server.public_ip
}

output "server_public_dns" {
  description = "Public DNS name of the OptiGrid server."
  value       = aws_instance.optigrid_server.public_dns
}

output "security_group_id" {
  description = "Security group ID attached to the OptiGrid server."
  value       = aws_security_group.optigrid_server.id
}
