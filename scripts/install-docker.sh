#!/usr/bin/env bash
set -e
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu noble stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update -qq
sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$(whoami)"
sudo systemctl enable docker
sudo systemctl start docker || sudo service docker start
echo DOCKER-INSTALL-OK
