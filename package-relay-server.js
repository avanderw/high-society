#!/usr/bin/env node

/**
 * High Society - Relay Server Packager
 * 
 * Creates a deployment package containing all necessary files to run
 * the relay server in a Docker environment on another machine.
 * 
 * Usage:
 *   node package-relay-server.js
 *   node package-relay-server.js --output ./my-package --include-env
 */

import { mkdir, copyFile, writeFile, readdir, stat, rm } from 'fs/promises';
import { createWriteStream, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const outputPath = args.includes('--output') 
  ? args[args.indexOf('--output') + 1] 
  : './relay-server-package';
const includeEnvTemplate = args.includes('--include-env');

// Define required files for deployment
const requiredFiles = [
  'relay-server.js',
  'package.json',
  'Dockerfile',
  '.dockerignore',
  'docker-compose.yml',
  'DEPLOY-RELAY-SERVER.md'
];

const optionalFiles = [
  'package-lock.json'
];

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  white: '\x1b[37m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function getDirectorySize(dirPath) {
  let size = 0;
  const files = await readdir(dirPath, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = join(dirPath, file.name);
    if (file.isDirectory()) {
      size += await getDirectorySize(filePath);
    } else {
      const stats = await stat(filePath);
      size += stats.size;
    }
  }
  
  return size;
}

async function createZipArchive(sourceDir, outputFile) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputFile);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(archive.pointer()));
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function main() {
  log('🎮 High Society - Relay Server Packager', 'cyan');
  log('========================================', 'cyan');
  log('');

  // Check if required files exist
  log('📋 Checking required files...', 'yellow');
  const missingFiles = [];
  
  for (const file of requiredFiles) {
    if (await fileExists(file)) {
      log(`  ✓ ${file}`, 'green');
    } else {
      log(`  ✗ ${file} (MISSING)`, 'red');
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    log('', 'white');
    log('❌ Error: Missing required files!', 'red');
    log('   Please ensure you\'re running this script from the project root.', 'yellow');
    process.exit(1);
  }

  // Check optional files
  for (const file of optionalFiles) {
    if (await fileExists(file)) {
      log(`  ✓ ${file} (optional)`, 'green');
    } else {
      log(`  ⚠ ${file} (optional, not found)`, 'yellow');
    }
  }

  log('', 'white');
  log('📦 Creating package directory...', 'yellow');

  // Create output directory
  if (existsSync(outputPath)) {
    log('  ⚠ Directory exists, cleaning...', 'yellow');
    await rm(outputPath, { recursive: true, force: true });
  }

  await mkdir(outputPath, { recursive: true });
  log(`  ✓ Created: ${outputPath}`, 'green');

  log('', 'white');
  log('📁 Copying files...', 'yellow');

  // Copy required files
  for (const file of requiredFiles) {
    await copyFile(file, join(outputPath, file));
    log(`  ✓ Copied: ${file}`, 'green');
  }

  // Copy optional files if they exist
  for (const file of optionalFiles) {
    if (await fileExists(file)) {
      await copyFile(file, join(outputPath, file));
      log(`  ✓ Copied: ${file}`, 'green');
    }
  }

  // Create .env.template if requested
  if (includeEnvTemplate) {
    log('', 'white');
    log('📝 Creating .env.template...', 'yellow');
    
    const envTemplate = `# High Society Relay Server - Environment Configuration
# Copy this file to .env and customize the values

# Port exposed on the host machine (default: 3000)
HOST_PORT=3000

# CORS origin - URL of your Svelte app
# Use * for testing, specific URL for production security
# Examples:
#   Development: CORS_ORIGIN=*
#   Production:  CORS_ORIGIN=https://your-app.com
#   Multiple:    CORS_ORIGIN=https://app1.com,https://app2.com
CORS_ORIGIN=*

# Optional: Node environment (default: production)
# NODE_ENV=production
`;
    
    await writeFile(join(outputPath, '.env.template'), envTemplate);
    log('  ✓ Created: .env.template', 'green');
  }

  // Create a README for the package
  log('', 'white');
  log('📝 Creating deployment instructions...', 'yellow');

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const deployReadme = `# High Society Relay Server - Deployment Package

This package contains everything needed to deploy the relay server to Docker.

## Quick Deployment Steps

1. **Copy this entire folder** to your Docker host machine

2. **Configure environment** (optional):
   \`\`\`bash
   # Copy the template and edit
   cp .env.template .env
   nano .env
   \`\`\`

3. **Deploy using Docker Compose**:
   \`\`\`bash
   docker-compose up -d
   \`\`\`

4. **Verify deployment**:
   \`\`\`bash
   docker-compose logs -f
   \`\`\`

5. **Update your Svelte app** to connect to:
   \`\`\`
   http://your-docker-host:3000
   \`\`\`

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

\`\`\`bash
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
\`\`\`

Generated on: ${now}
`;

  await writeFile(join(outputPath, 'README.txt'), deployReadme);
  log('  ✓ Created: README.txt', 'green');

  // Create a compressed archive (only if archiver is available)
  log('', 'white');
  log('🗜️  Creating compressed archive...', 'yellow');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const archiveName = `relay-server-deployment-${timestamp}.zip`;
  const archivePath = join(dirname(outputPath), archiveName);

  try {
    const archiveSize = await createZipArchive(outputPath, archivePath);
    const archiveSizeKB = (archiveSize / 1024).toFixed(2);
    log(`  ✓ Created: ${archivePath}`, 'green');
    log(`  ✓ Archive size: ${archiveSizeKB} KB`, 'green');
    
    // Clean up directory after successful archive creation
    log('', 'white');
    log('🧹 Cleaning up temporary directory...', 'yellow');
    await rm(outputPath, { recursive: true, force: true });
    log(`  ✓ Removed: ${outputPath}`, 'green');
  } catch (error) {
    log(`  ⚠ Failed to create archive: ${error.message}`, 'yellow');
    log('  Files are still available in: ' + outputPath, 'yellow');
  }

  // Summary
  log('', 'white');
  log('✅ Package created successfully!', 'green');
  log('', 'white');
  log('📦 Package location:', 'cyan');
  if (existsSync(archivePath)) {
    log(`   Archive:   ${archivePath}`, 'white');
  } else {
    log(`   Directory: ${outputPath}`, 'white');
  }
  log('', 'white');
  log('📤 Next steps:', 'cyan');
  log('   1. Copy the ZIP file to your Docker host machine', 'white');
  log('   2. Extract and follow instructions in README.txt', 'white');
  log('   3. Run: docker-compose up -d', 'white');
  log('', 'white');

  log('', 'white');
  log('🎉 Done!', 'green');
}

main().catch(error => {
  log('', 'white');
  log(`❌ Error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
