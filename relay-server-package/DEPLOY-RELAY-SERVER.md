# High Society Relay Server - Docker Deployment Guide

This guide explains how to deploy the relay server to a Docker environment on another computer.

## Prerequisites

- Docker installed on the target machine
- Docker Compose installed (optional, but recommended)
- Network access to the target machine from your Svelte app

## Quick Start

### Option 1: Using Docker Compose (Recommended)

1. **Copy files to target machine**
   
   Copy these files to your Docker host:
   - `relay-server.js`
   - `package.json`
   - `package-lock.json` (if it exists)
   - `Dockerfile`
   - `.dockerignore`
   - `docker-compose.yml`

2. **Create environment file** (optional)
   
   Create a `.env` file in the same directory:
   ```env
   # Port to expose on host machine
   HOST_PORT=3000
   
   # CORS origin - URL of your Svelte app
   # Use * for testing, specific URL for production
   CORS_ORIGIN=https://your-svelte-app.com
   ```

3. **Start the server**
   ```bash
   docker-compose up -d
   ```

4. **Verify it's running**
   ```bash
   docker-compose logs -f
   ```

### Option 2: Using Docker CLI

1. **Build the image**
   ```bash
   docker build -t high-society-relay:latest .
   ```

2. **Run the container**
   ```bash
   docker run -d \
     --name high-society-relay \
     -p 3000:3000 \
     -e CORS_ORIGIN="*" \
     --restart unless-stopped \
     high-society-relay:latest
   ```

3. **Check logs**
   ```bash
   docker logs -f high-society-relay
   ```

## Configuration

### Environment Variables

- **`PORT`** (default: `3000`)
  - Internal port the server listens on
  - Usually don't need to change this

- **`CORS_ORIGIN`** (default: `*`)
  - Allowed origins for CORS
  - For production, set to your Svelte app URL (e.g., `https://your-app.com`)
  - Multiple origins: `https://app1.com,https://app2.com`
  - Wildcard for development: `*`

- **`HOST_PORT`** (docker-compose only, default: `3000`)
  - Port exposed on the host machine
  - Change if port 3000 is already in use

### Example Production Configuration

```env
HOST_PORT=3000
CORS_ORIGIN=https://high-society.your-domain.com
```

## Connecting Your Svelte App

In your Svelte app configuration, set the relay server URL:

```javascript
// Update the WebSocket URL in your multiplayer service
const RELAY_SERVER_URL = 'http://your-docker-host:3000';
```

Or use environment variables:
```bash
# .env file in your Svelte project
PUBLIC_RELAY_SERVER_URL=http://your-docker-host:3000
```

## Management Commands

### Docker Compose

```bash
# Start server
docker-compose up -d

# Stop server
docker-compose down

# View logs
docker-compose logs -f

# Restart server
docker-compose restart

# Update and restart
docker-compose up -d --build

# Check status
docker-compose ps
```

### Docker CLI

```bash
# Start container
docker start high-society-relay

# Stop container
docker stop high-society-relay

# View logs
docker logs -f high-society-relay

# Restart container
docker restart high-society-relay

# Remove container
docker rm -f high-society-relay

# Check status
docker ps | grep high-society-relay
```

## Monitoring

### Health Checks

The container includes a health check that runs every 30 seconds:

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' high-society-relay
```

### View Real-time Logs

```bash
# Docker Compose
docker-compose logs -f --tail=100

# Docker CLI
docker logs -f --tail=100 high-society-relay
```

## Troubleshooting

### Container won't start

1. Check logs:
   ```bash
   docker logs high-society-relay
   ```

2. Verify port isn't in use:
   ```bash
   # Linux/Mac
   netstat -tuln | grep 3000
   
   # Windows
   netstat -ano | findstr :3000
   ```

3. Check container status:
   ```bash
   docker ps -a | grep high-society-relay
   ```

### Connection issues from Svelte app

1. **Check CORS configuration**: Ensure `CORS_ORIGIN` includes your Svelte app URL

2. **Verify firewall**: Make sure port 3000 is accessible:
   ```bash
   # Test from Svelte app host
   telnet your-docker-host 3000
   ```

3. **Check Docker networking**: Ensure container is on correct network

### Performance issues

1. **View resource usage**:
   ```bash
   docker stats high-society-relay
   ```

2. **Adjust resource limits** in `docker-compose.yml`:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '1.0'
         memory: 1G
   ```

## Security Recommendations

1. **Use specific CORS origins** in production (not `*`)
2. **Use HTTPS** for production deployments
3. **Set up a reverse proxy** (nginx/traefik) with SSL
4. **Enable firewall rules** to restrict access
5. **Keep Docker and Node.js updated**
6. **Monitor logs** for suspicious activity

## Updating the Server

1. **Pull latest code** on target machine
2. **Rebuild and restart**:
   ```bash
   docker-compose up -d --build
   ```
   Or with Docker CLI:
   ```bash
   docker stop high-society-relay
   docker rm high-society-relay
   docker build -t high-society-relay:latest .
   docker run -d --name high-society-relay -p 3000:3000 -e CORS_ORIGIN="*" high-society-relay:latest
   ```

## Backup and Restore

The relay server is stateless (doesn't persist data), so backups aren't necessary. However, keep a copy of your configuration:

- `.env` file
- `docker-compose.yml` (if customized)

## Advanced: Using Docker Registry

To deploy without copying files:

1. **Build and tag image**:
   ```bash
   docker build -t your-registry.com/high-society-relay:latest .
   ```

2. **Push to registry**:
   ```bash
   docker push your-registry.com/high-society-relay:latest
   ```

3. **Pull and run on target machine**:
   ```bash
   docker pull your-registry.com/high-society-relay:latest
   docker run -d -p 3000:3000 your-registry.com/high-society-relay:latest
   ```

## Support

For issues or questions:
- Check the main README.md
- Review TROUBLESHOOTING.md
- Check Docker logs for error messages
