# Logging Guide

This document explains the logging configuration for Wizard Tracker and how to customize it for different environments.

## Table of Contents

- [Overview](#overview)
- [Frontend Logging (Nginx)](#frontend-logging-nginx)
- [Backend Logging (Node.js)](#backend-logging-nodejs)
- [Log Formats](#log-formats)
- [Viewing Logs](#viewing-logs)
- [Log Analysis](#log-analysis)
- [Production Best Practices](#production-best-practices)

---

## Overview

Wizard Tracker uses a **dual logging strategy**:

1. **Frontend (Nginx)** - Access logs for HTTP requests
2. **Backend (Node.js/Express)** - Application logs for API operations

Both support multiple log formats optimized for different use cases.

---

## Frontend Logging (Nginx)

### Available Log Formats

The frontend Nginx server supports three log formats configured in `frontend/nginx.conf`:

#### 1. JSON Format (Recommended for Production)

**Use case:** Machine parsing, analytics, monitoring tools (Grafana, Loki, ELK)

**Example output:**
```json
{
  "timestamp":"2025-11-14T12:37:56+00:00",
  "client_ip":"172.23.0.1",
  "real_ip":"2a09:bac2:2d5e:2705::3e3:5",
  "method":"GET",
  "path":"/api/games/6913b335414c975b3bdead17",
  "protocol":"HTTP/1.1",
  "status":200,
  "bytes_sent":995,
  "request_time":0.045,
  "referrer":"https://wizard.jkrumboe.dev/settings",
  "user_agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
  "host":"wizard.jkrumboe.dev"
}
```

**Benefits:**
- ✅ Easy to parse programmatically
- ✅ Works with log aggregation tools
- ✅ Queryable by field (status, path, IP)
- ✅ Compact storage
- ✅ Perfect for Grafana dashboards

---

#### 2. Readable Format (Development)

**Use case:** Human debugging, development, troubleshooting

**Example output:**
```
[14/Nov/2025:12:37:56 +0000] GET /api/games/6913b335414c975b3bdead17
  Status: 200  |  Bytes: 995  |  Time: 0.045s
  Client: 172.23.0.1  |  Real IP: 2a09:bac2:2d5e:2705::3e3:5
  Referrer: https://wizard.jkrumboe.dev/settings
  Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)
```

**Benefits:**
- ✅ Easy to scan visually
- ✅ Multi-line format groups related info
- ✅ Clear labeling
- ✅ Great for terminal viewing

---

#### 3. Minimal Format (Quick Overview)

**Use case:** Quick scanning, performance analysis, low storage

**Example output:**
```
[14/Nov/2025:12:37:56 +0000] 200 GET /api/games/6913b335414c975b3bdead17 (0.045 s) - 172.23.0.1
```

**Benefits:**
- ✅ One line per request
- ✅ Most important info only
- ✅ Minimal storage
- ✅ Fast to scroll

---

### Switching Log Formats

Edit `frontend/nginx.conf` and change the `access_log` directive:

```nginx
# For JSON (production)
access_log /var/log/nginx/access.log json_combined;

# For readable (development)
access_log /var/log/nginx/access.log readable;

# For minimal (quick overview)
access_log /var/log/nginx/access.log minimal;
```

Then rebuild and restart:

```bash
npm run docker:rebuild
```

---

### Custom Log Format

You can create your own format in `nginx.conf`:

```nginx
log_format my_format
'$time_local | $status | $request | ${request_time}s';

server {
    access_log /var/log/nginx/access.log my_format;
}
```

**Available variables:**
- `$time_local` / `$time_iso8601` - Timestamp
- `$remote_addr` - Client IP
- `$http_x_real_ip` - Real IP (behind proxy)
- `$request_method` - GET, POST, etc.
- `$request_uri` - Full URL path
- `$status` - HTTP status code
- `$body_bytes_sent` - Response size
- `$request_time` - Request duration (seconds)
- `$http_referer` - Referrer URL
- `$http_user_agent` - User agent string
- `$host` - Hostname

See [Nginx documentation](http://nginx.org/en/docs/http/ngx_http_log_module.html) for more.

---

## Backend Logging (Node.js)

### Current Setup

The backend currently uses basic `console.log` statements. 

### Recommended: Morgan Middleware

For better backend logging, add the `morgan` middleware to `backend/server.js`:

#### Installation

```bash
cd backend
npm install morgan
```

#### Configuration

Add to `backend/server.js`:

```javascript
const morgan = require('morgan');

// JSON format for production
morgan.token('timestamp', () => new Date().toISOString());

app.use(morgan((tokens, req, res) => {
  return JSON.stringify({
    timestamp: tokens.timestamp(req, res),
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: tokens.status(req, res),
    response_time: tokens['response-time'](req, res),
    content_length: tokens.res(req, res, 'content-length'),
    remote_addr: tokens['remote-addr'](req, res),
    user_agent: tokens['user-agent'](req, res)
  });
}));

// Or use readable format for development
// app.use(morgan('dev'));
```

### Example Output (JSON)

```json
{
  "timestamp": "2025-11-14T12:37:56.123Z",
  "method": "GET",
  "url": "/api/games",
  "status": "200",
  "response_time": "12.456",
  "content_length": "825",
  "remote_addr": "172.23.0.1",
  "user_agent": "Mozilla/5.0 ..."
}
```

### Example Output (Dev Format)

```
GET /api/games 200 12.456 ms - 825
```

---

## Log Formats

### Comparison Table

| Format | Best For | Readability | Storage | Parsing | Monitoring |
|--------|----------|-------------|---------|---------|------------|
| **JSON** | Production | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Readable** | Development | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐ |
| **Minimal** | Quick Scan | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Combined** | Legacy | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

---

## Viewing Logs

### Docker Compose Logs

```bash
# All logs
npm run logs

# Frontend only
npm run logs:frontend

# Backend only
npm run logs:backend

# Follow logs (live)
docker compose logs -f frontend

# Last 100 lines
docker compose logs --tail=100 frontend
```

### Inside Container

```bash
# Access frontend container
docker exec -it wizard-tracker-frontend-1 sh

# View access logs
tail -f /var/log/nginx/access.log

# View error logs
tail -f /var/log/nginx/error.log

# View with jq (for JSON logs)
tail -f /var/log/nginx/access.log | jq
```

### Save Logs to File

```bash
# Save frontend logs
docker compose logs frontend > frontend-logs.txt

# Save JSON logs and format
docker compose logs frontend | grep '{' | jq > formatted-logs.json
```

---

## Log Analysis

### Using `jq` (JSON Logs)

#### Count requests by status code
```bash
cat access.log | jq -r '.status' | sort | uniq -c | sort -rn
```

Output:
```
  245 200
   12 304
    3 404
    1 500
```

#### Find slow requests (> 1 second)
```bash
cat access.log | jq 'select(.request_time > 1) | {path, request_time, status}'
```

#### Top 10 most accessed endpoints
```bash
cat access.log | jq -r '.path' | sort | uniq -c | sort -rn | head -10
```

#### Filter by IP address
```bash
cat access.log | jq 'select(.client_ip == "172.23.0.1")'
```

#### Find errors (4xx, 5xx)
```bash
cat access.log | jq 'select(.status >= 400)'
```

#### Average response time by endpoint
```bash
cat access.log | jq -r '"\(.path) \(.request_time)"' | \
  awk '{sum[$1]+=$2; count[$1]++} END {for (path in sum) print path, sum[path]/count[path]}'
```

---

### Using `grep` (Any Format)

#### Find 404 errors
```bash
grep '404' access.log
```

#### Count requests per minute
```bash
grep '14/Nov/2025:12:37' access.log | wc -l
```

#### Find requests from specific IP
```bash
grep '172.23.0.1' access.log
```

#### Find API requests only
```bash
grep '/api/' access.log
```

---

## Production Best Practices

### 1. Log Rotation

Prevent logs from filling up disk space:

Create `frontend/logrotate.conf`:

```conf
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 nginx adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
```

Add to Dockerfile:

```dockerfile
COPY logrotate.conf /etc/logrotate.d/nginx
```

---

### 2. Log Aggregation

**Recommended: Grafana Loki + Promtail**

#### Docker Compose Addition

```yaml
loki:
  image: grafana/loki:latest
  ports:
    - "3100:3100"
  volumes:
    - ./loki-config.yml:/etc/loki/local-config.yaml

promtail:
  image: grafana/promtail:latest
  volumes:
    - /var/log:/var/log
    - ./promtail-config.yml:/etc/promtail/config.yml
  depends_on:
    - loki

grafana:
  image: grafana/grafana:latest
  ports:
    - "3001:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
  depends_on:
    - loki
```

---

### 3. Sensitive Data Filtering

**Never log:**
- Passwords
- API keys
- JWT tokens
- Credit card numbers
- Personal information (depending on regulations)

Add to `nginx.conf`:

```nginx
# Filter sensitive data from logs
map $request_uri $loggable {
    ~*password 0;
    ~*token 0;
    ~*api_key 0;
    default 1;
}

server {
    access_log /var/log/nginx/access.log json_combined if=$loggable;
}
```

---

### 4. Performance Considerations

**Skip logging for:**
- Health checks
- Static assets (optional)
- Monitoring pings

```nginx
# Don't log health checks
location /api/health {
    access_log off;
    # ... rest of config
}

# Don't log static assets
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    access_log off;
    # ... rest of config
}
```

---

### 5. Error Log Levels

Configure error log verbosity:

```nginx
# error_log <file> <level>;
error_log /var/log/nginx/error.log warn;  # default
error_log /var/log/nginx/error.log error; # production (less verbose)
error_log /var/log/nginx/error.log debug; # development (very verbose)
```

Levels: `debug`, `info`, `notice`, `warn`, `error`, `crit`, `alert`, `emerg`

---

## Monitoring Dashboard Setup

### Grafana Dashboard for Nginx Logs

1. **Add Loki Data Source** in Grafana
2. **Import Dashboard** (ID: 12559 - Nginx Log Dashboard)
3. **Customize Queries**:

```logql
# Request rate
rate({job="nginx"}[5m])

# Error rate
rate({job="nginx"} | json | status >= 400 [5m])

# 95th percentile response time
quantile_over_time(0.95, {job="nginx"} | json | unwrap request_time [5m])

# Top endpoints
topk(10, sum by (path) (rate({job="nginx"} | json [5m])))
```

---

## Quick Reference

### Common Commands

```bash
# View logs
npm run logs:frontend

# Follow logs live
docker compose logs -f frontend

# Search logs
docker compose logs frontend | grep "error"

# Count status codes (JSON)
docker compose logs frontend | grep '{' | jq -r '.status' | sort | uniq -c

# Save logs
docker compose logs frontend > logs.txt

# Clear logs (restart containers)
docker compose restart frontend
```

### Log Format Presets

```nginx
# Change this line in nginx.conf:
access_log /var/log/nginx/access.log <FORMAT>;

# Formats:
- json_combined  # Production (machine parsing)
- readable       # Development (human reading)
- minimal        # Quick scan
```

### Troubleshooting Logs

| Issue | Solution |
|-------|----------|
| **Logs not appearing** | Check `docker compose logs frontend` |
| **Container not running** | Run `docker ps` and `npm start` |
| **Can't read JSON logs** | Install `jq`: `sudo apt install jq` |
| **Logs too large** | Implement log rotation |
| **Need historical logs** | Set up log aggregation (Loki) |

---

## Additional Resources

- [Nginx Logging Documentation](http://nginx.org/en/docs/http/ngx_http_log_module.html)
- [Morgan (Node.js) Documentation](https://github.com/expressjs/morgan)
- [Grafana Loki Documentation](https://grafana.com/docs/loki/latest/)
- [jq Manual](https://stedolan.github.io/jq/manual/)

---

## Contributing

If you have suggestions for improving logging:

1. Test your changes locally
2. Document the benefits
3. Submit a PR with updated `LOGGING.md`
4. Include examples of the new log format

---

**Need Help?**
- 📖 Check [SCRIPTS.md](SCRIPTS.md) for log viewing commands
- 💬 Open a [GitHub Discussion](https://github.com/jkrumboe/wizard-tracker/discussions)
- 🐛 Report issues via [GitHub Issues](https://github.com/jkrumboe/wizard-tracker/issues)
