# OptiGrid Terraform (Production Server)

This Terraform configuration provisions one Ubuntu EC2 server (default `t3.medium`, ~4GB RAM) for running the OptiGrid Docker Compose stack.

## Required Variables

- `aws_region`
- `environment`
- `project_name`
- `instance_type`
- `ssh_public_key`
- `allowed_ssh_cidr`

## Usage

1. Copy the example variables file and edit values:

```bash
cp terraform.tfvars.example terraform.tfvars
```

2. Initialize Terraform:

```bash
terraform init
```

3. Review planned changes:

```bash
terraform plan
```

4. Apply infrastructure:

```bash
terraform apply
```

5. Destroy infrastructure when no longer needed:

```bash
terraform destroy
```

## Notes

- No AWS keys are stored here; use your local AWS credentials/profile.
- Public ingress is limited to ports `22`, `80`, and `443`.
- Internal app ports remain private on the host and should be reverse-proxied if exposed.
