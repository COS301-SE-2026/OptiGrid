#!/bin/bash
set -euxo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y docker.io

systemctl enable docker
systemctl start docker

# Allow Ubuntu default user to run Docker without sudo.
usermod -aG docker ubuntu

docker --version > /var/log/docker-version.txt
echo "Docker bootstrap complete at $(date -Iseconds)" > /var/log/docker-bootstrap.txt
