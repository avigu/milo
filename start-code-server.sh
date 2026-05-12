#!/bin/bash
# Definitive wrapper to start code-server without the conflicting PORT variable

# Unset the conflicting PORT variable
unset PORT

# Use the config file we created
CONFIG_FILE="/data/.openclaw/workspace/code-server-config.yaml"

# Create the config file specifically for this script to be sure
cat <<EOF > "$CONFIG_FILE"
bind-addr: 0.0.0.0:8081
auth: password
password: Riddle!App-VSCode-P@ssw0rd-2026
EOF

# Launch code-server
echo "Starting code-server on port 8081..."
/usr/bin/code-server --config "$CONFIG_FILE" /data/.openclaw/workspace
