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
