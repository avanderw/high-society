# High Society Relay Server - Deployment Package

This package contains everything needed to deploy the relay server to Docker.

## Quick Deployment Steps

1. **Copy this entire folder** to your Docker host machine

2. **Configure environment** (optional):
   ```bash
   # Copy the template and edit
   cp .env.template .env
   nano .env
   ```

3. **Deploy using Docker Compose**:
   ```bash
   docker-compose up -d
   ```

4. **Verify deployment**:
   ```bash
   docker-compose logs -f
   ```

5. **Update your Svelte app** to connect to:
   ```
   http://your-docker-host:3000
   ```

## Package Contents

- **relay-server.js** - The WebSocket relay server
- **package.json** - Node.js dependencies
- **Dockerfile** - Container build instructions
- **.dockerignore** - Files to exclude from container
- **docker-compose.yml** - Docker Compose configuration
- **DEPLOY-RELAY-SERVER.md** - Detailed deployment guide

## Need Help?

See **DEPLOY-RELAY-SERVER.md** for:
- Detailed deployment instructions
- Configuration options
- Troubleshooting guide
- Security recommendations
- Management commands

## Quick Commands

```bash
# Start server
docker-compose up -d

# View logs
docker-compose logs -f

# Stop server
docker-compose down

# Restart server
docker-compose restart

# Update server
docker-compose up -d --build
```

Generated on: 2025-11-13 07:40:15
