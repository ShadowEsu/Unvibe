#!/usr/bin/env bash
# Enable Datadog Agent log collection for a Python file source (macOS package install).
# Real config path on this machine: /opt/datadog-agent/etc/datadog.yaml
# (Datadog's UI still says ~/.datadog-agent/datadog.yaml — that path is not used here.)
set -euo pipefail

DATADOG_YAML="/opt/datadog-agent/etc/datadog.yaml"
CONF_DIR="/opt/datadog-agent/etc/conf.d/python.d"
CONF_FILE="${CONF_DIR}/conf.yaml"
LOG_DIR="/var/log/myapplication"
LOG_FILE="${LOG_DIR}/python.log"
SERVICE_NAME="myapplication"

if [[ ! -f "${DATADOG_YAML}" ]]; then
  echo "Missing ${DATADOG_YAML}. Is the Datadog Agent installed?"
  exit 1
fi

echo "This script needs sudo to edit Agent config and restart the service."
sudo true

# 1) Enable log collection
sudo python3 - <<'PY'
from pathlib import Path
p = Path("/opt/datadog-agent/etc/datadog.yaml")
text = p.read_text()
lines = [l.strip() for l in text.splitlines()]
if "logs_enabled: true" in lines:
    print("logs_enabled already true")
elif "# logs_enabled: false" in text:
    p.write_text(text.replace("# logs_enabled: false", "logs_enabled: true", 1))
    print("Uncommented and set logs_enabled: true")
elif "logs_enabled: false" in text:
    p.write_text(text.replace("logs_enabled: false", "logs_enabled: true", 1))
    print("Set logs_enabled: true")
else:
    p.write_text("logs_enabled: true\n" + text)
    print("Prepended logs_enabled: true")
PY

# 2–3) Log file + python.d source
sudo mkdir -p "${LOG_DIR}" "${CONF_DIR}"
sudo touch "${LOG_FILE}"
sudo chmod 755 "${LOG_DIR}"
sudo chmod 644 "${LOG_FILE}"

sudo tee "${CONF_FILE}" >/dev/null <<EOF
#Log section
logs:

  - type: file
    path: ${LOG_FILE}
    service: ${SERVICE_NAME}
    source: python
    sourcecategory: sourcecode
EOF
sudo chown _dd-agent:admin "${CONF_FILE}"
sudo chmod 640 "${CONF_FILE}"

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "${ts} INFO ${SERVICE_NAME} boot — Datadog log collection test" | sudo tee -a "${LOG_FILE}" >/dev/null

# 4) Restart Agent
if sudo /usr/local/bin/datadog-agent restart; then
  echo "Agent restarted via datadog-agent restart"
else
  echo "Trying launchctl kickstart…"
  sudo launchctl kickstart -k system/com.datadoghq.agent || true
fi

sleep 3
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "${ts} INFO ${SERVICE_NAME} heartbeat — confirm Datadog ingestion" | sudo tee -a "${LOG_FILE}" >/dev/null

echo
echo "Configured:"
echo "  logs_enabled → $(sudo grep -E '^logs_enabled:' "${DATADOG_YAML}" | head -1)"
echo "  source conf  → ${CONF_FILE}"
echo "  log file     → ${LOG_FILE}"
echo
echo "Logs Agent status excerpt:"
sudo /usr/local/bin/datadog-agent status 2>/dev/null | grep -i -E 'Logs Agent|python|myapplication' | head -30 || true
echo
echo "Return to the Datadog UI — confirmation can take a few minutes."
echo "To emit more test lines: echo \"\$(date -u +%Y-%m-%dT%H:%M:%SZ) INFO test\" | sudo tee -a ${LOG_FILE}"
