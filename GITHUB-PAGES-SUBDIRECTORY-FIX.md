# GitHub Pages Subdirectory Deployment - Fixed! ✅

## Problem Solved

Your app is now correctly configured to deploy to `https://avanderw.co.za/high-society/` instead of the root.

## What Was Fixed

### 1. SvelteKit Base Path (`svelte.config.js`)
```javascript
paths: {
    base: dev ? '' : '/high-society'
}
```
- **Development**: Uses root path `/` for local testing
- **Production**: Uses `/high-society` for GitHub Pages

### 2. Vite Base Configuration (`vite.config.ts`)
```typescript
const base = '/high-society/';
```
- Sets base URL for all assets
- Configures PWA scope and start_url
- Updates manifest icon paths

### 3. Asset References (`app.html`)
```html
<link rel="manifest" href="%sveltekit.assets%/manifest.webmanifest" />
<link rel="apple-touch-icon" href="%sveltekit.assets%/icon-192.png" />
```
- Uses SvelteKit's `%sveltekit.assets%` placeholder
- Automatically resolves to correct path based on environment

### 4. Service Worker Registration (`+layout.svelte`)
```typescript
const base = import.meta.env.BASE_URL || '/';
navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
```
- Dynamically uses the configured base path
- Works in both dev and production

### 5. Manifest Configuration
All paths now correctly reference `/high-society/`:
- `start_url`: `/high-society/`
- `scope`: `/high-society/`
- `icons`: `/high-society/icon-192.png`, etc.

## Verification

### Build Output
✅ `build/index.html` - Links use relative paths (`./ `)
✅ `build/manifest.webmanifest` - All paths include `/high-society/`
✅ `build/sw.js` - Service worker generated correctly
✅ Assets base set to `/high-society`

### Manifest Content
```json
{
  "start_url": "/high-society/",
  "scope": "/high-society/",
  "icons": [
    {"src": "/high-society/icon-192.png", ...},
    {"src": "/high-society/icon-512.png", ...}
  ]
}
```

## Deployment Steps

### 1. Commit and Push
```bash
git add .
git commit -m "Configure PWA for GitHub Pages subdirectory deployment"
git push origin main
```

### 2. GitHub Actions Will:
- ✅ Build the project with base path `/high-society/`
- ✅ Generate all PWA files (manifest, service worker, workbox)
- ✅ Deploy to GitHub Pages

### 3. Access Your App
- **URL**: `https://avanderw.co.za/high-society/`
- **Service Worker**: `https://avanderw.co.za/high-society/sw.js`
- **Manifest**: `https://avanderw.co.za/high-society/manifest.webmanifest`

## Testing Locally

### Development Mode (Root Path)
```bash
npm run dev
# Opens at http://localhost:5173/
# PWA features work with root path
```

### Production Preview (Subdirectory Path)
```bash
npm run build
npm run preview
# Opens at http://localhost:4173/
# But URLs will expect /high-society/ base
```

**Note**: Preview mode will show 404s for assets because it serves from root. This is expected - it will work correctly on GitHub Pages.

## After Deployment

### Verify PWA Installation
1. Open `https://avanderw.co.za/high-society/`
2. Check browser console - no 404 errors
3. DevTools → Application → Manifest - should load successfully
4. DevTools → Application → Service Workers - should register
5. Install prompt should appear (⊕ icon in address bar)

### Expected Behavior
- ✅ All assets load from `/high-society/` path
- ✅ Service worker registers at `/high-society/sw.js`
- ✅ Manifest loads from `/high-society/manifest.webmanifest`
- ✅ Icons load from `/high-society/icon-*.png`
- ✅ App installable as PWA
- ✅ Works offline after first visit

## Troubleshooting

### If you see 404 errors on GitHub Pages:

**Check GitHub Pages Settings:**
1. Go to repository Settings → Pages
2. Verify: Source = "GitHub Actions"
3. Check the deployment URL matches your domain

**Clear Browser Cache:**
1. DevTools → Application → Clear storage
2. Check "Unregister service workers"
3. Click "Clear site data"
4. Hard refresh (Ctrl+Shift+R)

**Verify Build:**
```bash
# Check the built index.html
cat build/index.html | grep manifest
# Should show: href="./manifest.webmanifest"

# Check the manifest
cat build/manifest.webmanifest
# Should show: "start_url": "/high-society/"
```

## Development vs Production

| Feature | Development | Production |
|---------|------------|------------|
| Base Path | `/` | `/high-society/` |
| URL | `localhost:5173/` | `avanderw.co.za/high-society/` |
| SW Scope | `/` | `/high-society/` |
| Assets | `/icon-192.png` | `/high-society/icon-192.png` |

## Configuration Summary

### Files Changed:
- ✅ `svelte.config.js` - Added conditional base path
- ✅ `vite.config.ts` - Configured base URL and PWA paths  
- ✅ `src/app.html` - Used SvelteKit asset placeholders
- ✅ `src/routes/+layout.svelte` - Dynamic SW registration

### No Changes Needed:
- ✅ `.github/workflows/github-pages.yml` - Already correct
- ✅ `package.json` - Scripts work as-is
- ✅ Component files - All use relative imports

## Next Steps

1. **Push to GitHub**: `git push origin main`
2. **Wait for Deployment**: Check Actions tab for build status
3. **Test Live**: Visit `https://avanderw.co.za/high-society/`
4. **Install PWA**: Click the install prompt
5. **Test Offline**: Disconnect network and reload

Done! Your PWA will now work correctly on GitHub Pages! 🎉
