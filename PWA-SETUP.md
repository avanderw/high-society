# PWA Setup Instructions

## Overview
This application is now configured as a Progressive Web App (PWA) with:
- Installable on desktop and mobile devices
- Offline capability with service worker caching
- Automatic update detection and user prompts
- Cache busting on redeployments

## Required Setup Steps

### 1. Generate PWA Icons
Before building/deploying, you need to create the PWA icons:

1. Open `icon-generator.html` in a web browser
2. Download both `icon-192.png` and `icon-512.png`
3. Place them in the `static/` folder

Alternatively, create your own icons (192x192 and 512x512 PNG files) and place them in `static/`.

### 2. Build the Application
```bash
npm run build
```

This will:
- Build the SvelteKit application
- Generate the service worker
- Create the web manifest
- Set up caching strategies

### 3. Preview Locally
```bash
npm run preview
```

Visit the local URL and test PWA features:
- Check if install prompt appears (Desktop: address bar icon, Mobile: browser menu)
- Install the app
- Test offline functionality (disconnect network)
- Test update detection (make a change, rebuild, and reload)

### 4. Deploy
Deploy the contents of the `build/` directory to your static hosting service.

## How Update Detection Works

### User Experience
1. When a new version is deployed, the service worker detects it
2. A modal dialog appears: "Update Available"
3. User can choose "Later" or "Update Now"
4. If "Update Now" is clicked, the app updates and reloads automatically

### Technical Details
- Service worker checks for updates every 30 seconds
- Each build generates a unique cache name based on the version
- Old caches are automatically cleaned up on activation
- The `UpdatePrompt` component manages the UI and update flow

## Cache Strategy
- **Install**: All built files and static assets are cached immediately
- **Fetch**: Cache-first strategy with network fallback
- **Update**: Old caches are deleted when a new service worker activates

## Development Mode
PWA features are enabled in development mode for testing:
- Service worker runs in dev mode
- Install prompt available
- Update detection works with hot reload

## Troubleshooting

### Install prompt doesn't appear
- Make sure you're using HTTPS (or localhost)
- Check browser console for service worker registration errors
- Clear browser cache and reload

### Updates not detected
- Check browser DevTools > Application > Service Workers
- Click "Update" to manually check for service worker updates
- Ensure the new version was actually deployed

### Offline mode not working
- Check that service worker is activated
- Verify cache storage in DevTools > Application > Cache Storage
- Ensure all required assets are in the cache

## Configuration Files

### `vite.config.ts`
- PWA plugin configuration
- Manifest settings
- Cache patterns
- Service worker strategy

### `src/service-worker.ts`
- Custom service worker implementation
- Cache management
- Update lifecycle
- Fetch strategies

### `src/lib/components/UpdatePrompt.svelte`
- Update notification UI
- Service worker communication
- User interaction handling
