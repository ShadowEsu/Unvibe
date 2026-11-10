#!/usr/bin/env python3
"""QA (webapp-mac.sh): every request a Chrome net log holds to unvibe.site or api.unvibe.site, with its UTC time, then
the counts: /explain page loads (no _rsc), POSTs to those hosts, POSTs to /api/v1/try (the Try request).
Usage: netlog-summary.py <netlog.json> <label>"""
import datetime
import json
import sys
from urllib.parse import parse_qs, urlsplit

path, label = sys.argv[1], sys.argv[2]
text = open(path, encoding="utf-8", errors="replace").read().rstrip()
data = None
# A log Chrome didn't close cleanly ends inside the events array.
for candidate in (text, text.rstrip(",") + "]}", text[: text.rfind("},") + 1] + "]}"):
    try:
        data = json.loads(candidate)
        break
    except ValueError:
        continue
if data is None:
    print(f"NETLOG {label} unreadable ({len(text)} bytes)")
    sys.exit(1)

consts = data.get("constants", {})
start_job = consts.get("logEventTypes", {}).get("URL_REQUEST_START_JOB")
offset = int(consts.get("timeTickOffset", 0))
pages = {"unvibe.site", "www.unvibe.site"}
hosts = pages | {"api.unvibe.site"}
loads = posts = tries = 0
for ev in data.get("events", []):
    if ev.get("type") != start_job:
        continue
    params = ev.get("params") or {}
    url, method = params.get("url", ""), params.get("method", "")
    u = urlsplit(url)
    if u.hostname not in hosts:
        continue
    at = datetime.datetime.fromtimestamp((offset + int(ev.get("time", "0"))) / 1000, datetime.timezone.utc)
    print(f"NETLOG {label} {at.strftime('%H:%M:%S.%f')[:-3]}Z {method} {url}")
    if method == "POST":
        posts += 1
        if u.path.rstrip("/") == "/api/v1/try":
            tries += 1
    if method == "GET" and u.hostname in pages and u.path == "/explain" and "_rsc" not in parse_qs(u.query):
        loads += 1
print(f"COUNT {label} explain_page_loads={loads} unvibe_posts={posts} try_posts={tries}")
