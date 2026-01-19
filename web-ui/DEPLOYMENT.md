# Ralph Web UI - Deployment Guide

This guide covers deploying the Ralph Web UI to various environments including Vercel, Docker, and local development setups.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Vercel Deployment](#vercel-deployment)
- [Docker Deployment](#docker-deployment)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18.x or later
- npm or yarn package manager
- Git (for cloning the repository)
- For Docker: Docker and Docker Compose

## Environment Variables

The Web UI uses the following environment variables. Copy `.env.example` to `.env.local` and configure as needed:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_WS_URL` | WebSocket server URL for real-time updates | `ws://localhost:3002` | No |
| `NEXT_PUBLIC_POLL_INTERVAL_MS` | Fallback polling interval in milliseconds | `5000` | No |
| `NODE_ENV` | Environment (production/development) | `development` | No |

### Example `.env.local` file

```bash
# WebSocket Configuration
NEXT_PUBLIC_WS_URL=ws://localhost:3002

# Polling Fallback (used when WebSocket is unavailable)
NEXT_PUBLIC_POLL_INTERVAL_MS=5000

# Environment
NODE_ENV=development
```

## Local Development

### Quick Start

1. **Navigate to the web-ui directory:**
   ```bash
   cd web-ui
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Optional: Run WebSocket Server

For real-time updates, you can run the WebSocket server alongside the dev server:

```bash
# Terminal 1: Run Next.js dev server
npm run dev

# Terminal 2: Run WebSocket server
npm run ws-server
```

### Running Tests

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in debug mode
npm run test:e2e:debug

# Run E2E tests in headed mode (with browser window)
npm run test:e2e:headed
```

## Vercel Deployment

Vercel is the recommended platform for deploying the Ralph Web UI. It provides:

- Zero-configuration deployment
- Automatic HTTPS
- Edge network caching
- Preview deployments for pull requests

### Deploying to Vercel

#### Option 1: Using the Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   cd web-ui
   vercel
   ```

3. **Follow the prompts:**
   - Set up and deploy
   - Link to existing project or create new
   - Configure project settings if needed

#### Option 2: Using Vercel Dashboard

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/ralph.git
   git push -u origin main
   ```

2. **Import project on Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Select the `web-ui` directory as root directory

3. **Configure environment variables:**
   - In Vercel project settings, add environment variables
   - Add `NEXT_PUBLIC_WS_URL` with your WebSocket server URL
   - Add any other required variables

4. **Deploy:**
   - Vercel will automatically deploy on push to main branch
   - Preview deployments are created for pull requests

### Vercel Configuration

The `vercel.json` file in the web-ui directory contains:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"]
}
```

### Custom Domains (Optional)

1. In Vercel project settings, go to "Domains"
2. Add your custom domain
3. Configure DNS records as instructed by Vercel
4. Vercel will automatically provision SSL certificates

## Docker Deployment

Docker provides a consistent environment across development and production.

### Building the Docker Image

1. **Navigate to the web-ui directory:**
   ```bash
   cd web-ui
   ```

2. **Build the image:**
   ```bash
   docker build -t ralph-web-ui:latest .
   ```

3. **Tag the image (for pushing to registry):**
   ```bash
   docker tag ralph-web-ui:latest your-registry/ralph-web-ui:latest
   ```

### Running with Docker

#### Running Locally

```bash
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_WS_URL=ws://localhost:3002 \
  ralph-web-ui:latest
```

#### Running with Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  web-ui:
    build: ./web-ui
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_WS_URL=ws://ws-server:3002
      - NODE_ENV=production
    depends_on:
      - ws-server

  ws-server:
    build: ./web-ui
    command: npm run ws-server
    ports:
      - "3002:3002"
```

Then run:

```bash
docker-compose up -d
```

### Docker Configuration

The `Dockerfile` includes:

- Multi-stage build for smaller image size
- Non-root user for security
- Health check endpoint
- Optimized layer caching

### Docker Images

Build arguments and environment variables can be configured:

```bash
docker build \
  --build-arg NODE_ENV=production \
  -t ralph-web-ui:latest .
```

## Production Checklist

Before deploying to production, ensure:

- [ ] Environment variables are properly configured
- [ ] `.env.example` is up to date with all required variables
- [ ] Build process completes without errors (`npm run build`)
- [ ] All tests pass (`npm test` and `npm run test:e2e`)
- [ ] Linting passes (`npm run lint`)
- [ ] WebSocket server URL is accessible (if using real-time updates)
- [ ] HTTPS is enabled (Vercel handles this automatically)
- [ ] Error monitoring is configured (optional, e.g., Sentry)
- [ ] Analytics is configured (optional)

## Monitoring and Maintenance

### Health Checks

The application includes a built-in health check at `/api/health`.

### Logs

- **Vercel:** View logs in the Vercel Dashboard under your project
- **Docker:** Use `docker logs` or configure a log aggregation service

### Performance Monitoring

Consider integrating:
- Vercel Analytics (included with Vercel deployments)
- Sentry for error tracking
- Google Analytics or Plausible for usage analytics

## Troubleshooting

### Build Errors

**Problem:** Build fails with "Module not found" errors.

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Environment Variables Not Working

**Problem:** Environment variables are undefined in the application.

**Solution:**
- Ensure variables are prefixed with `NEXT_PUBLIC_` for client-side access
- Restart the development server after adding new variables
- Check that `.env.local` is in the web-ui directory

### WebSocket Connection Fails

**Problem:** Real-time updates not working.

**Solution:**
- Check that `NEXT_PUBLIC_WS_URL` is correctly set
- Ensure WebSocket server is running
- Check browser console for connection errors
- The app will automatically fall back to polling if WebSocket fails

### Docker Container Exits Immediately

**Problem:** Docker container exits with code 1.

**Solution:**
- Check logs: `docker logs <container-id>`
- Ensure build succeeded: `docker build -t ralph-web-ui .`
- Verify port 3000 is not already in use

### Slow Performance

**Problem:** Application loads slowly.

**Solution:**
- Enable production mode: `NODE_ENV=production`
- Check network latency if using remote WebSocket server
- Reduce `NEXT_PUBLIC_POLL_INTERVAL_MS` if using polling fallback
- Enable Next.js image optimization

## Security Considerations

1. **API Routes:** Ensure API routes validate and sanitize inputs
2. **CORS:** Configure CORS appropriately for your WebSocket server
3. **Dependencies:** Regularly update dependencies: `npm audit fix`
4. **Environment Variables:** Never commit `.env.local` files
5. **HTTPS:** Always use HTTPS in production (Vercel handles this)

## Additional Resources

- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Docker Documentation](https://docs.docker.com/)
- [Playwright Documentation](https://playwright.dev/docs/intro)

## Support

For issues or questions:
- Check the [troubleshooting section](#troubleshooting)
- Review existing GitHub issues
- Create a new issue with details about your deployment environment
