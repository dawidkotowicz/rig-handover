---
name: preview-upload
description: Put one rig page up as a public HTML preview on the droplet, upload a clean copy over it after review, and take it down. Use for any plan step that sends a reviewer a preview link (ADR 0003).
---

# preview-upload

One page, one public HTTPS link, uploaded over later, taken down at the end.

- Host: the droplet `165.245.198.127`, Caddy serving `/var/www/preview/` as
  `https://165-245-198-127.sslip.io/`. Caddy gets the HTTPS certificate itself.
- Who uploads: the human, from their own computer (`scp`). An agent workspace may not reach the
  droplet; the agent prepares the file and the commands.
- Link for a page: `https://165-245-198-127.sslip.io/<name>.html`. One name per preview, e.g.
  `digest.html`. Reuse the name for the clean copy so the link stays the same.

## Rules

- Ask the human before every upload, the overwrite and the take-down: say what goes public,
  where, who can see it, and how to undo it.
- The file holds only sample data and the lane marker. Never secrets, never `.env` values.
- Never put a preview in the repo, an issue or a chat attachment (ADR 0003): the marker can't be
  taken off there. Hand the file over through a folder on the human's computer.
- The issue that sends the preview stays open until the reviewer has looked. Don't close it, and
  don't take the marker off, before the review is in.

## 1. Save the page (with the marker)

```sh
cp .env.example .env                       # once; set LANE_MARKER
PORT=8799 pnpm start &                     # run rig
curl -sSf -o preview/<name>.html localhost:8799/<path>
grep -c "$LANE_MARKER" preview/<name>.html # expect 1
kill %1
```

A command, not a browser "save as": the page is one self-contained file (ADR 0001).
Keep `preview/` outside the repo, or git-ignored.

## 2. Put it up (human, PowerShell)

Copy the file to the human's computer (e.g. Downloads), then they run:

```
scp $HOME\Downloads\<name>.html root@165.245.198.127:/var/www/preview/<name>.html
```

## 3. Check the link before sending it

The human opens the link in a browser and presses Ctrl+F5. The agent may also fetch it, but a
fetch tool can return a cached copy: add a fresh query string (`?v=<time>`), and when the
fetch and the human's browser disagree, the browser wins.

## 4. Clean copy over the same link (after the review)

```sh
PORT=8799 LANE_MARKER= pnpm start &
curl -sSf -o preview/<name>-clean.html localhost:8799/<path>
grep -c "no marker set" preview/<name>-clean.html   # expect 1
kill %1
```

Human:

```
scp $HOME\Downloads\<name>-clean.html root@165.245.198.127:/var/www/preview/<name>.html
ssh root@165.245.198.127 "grep -o 'no marker set\|<marker>' /var/www/preview/<name>.html"
```

The last line must read `no marker set`.

## 5. Take it down

```
ssh root@165.245.198.127 "rm /var/www/preview/<name>.html"
```

The link then answers 404. To stop serving previews at all: `systemctl stop caddy`.

## Droplet setup (once)

```
ss -ltnp | grep -E ':(80|443)\b'          # must be empty, or Caddy can't bind
apt update && apt install -y caddy
mkdir -p /var/www/preview
printf '165-245-198-127.sslip.io {\n\troot * /var/www/preview\n\tfile_server\n}\n' > /etc/caddy/Caddyfile
ufw status | grep -q active && ufw allow 80,443/tcp
systemctl restart caddy
```

A DigitalOcean Cloud Firewall on the droplet needs inbound TCP 80 and 443 too.
