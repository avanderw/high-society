import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { join } from 'path';

function generateIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Background - dark blue
    ctx.fillStyle = '#11191f';
    ctx.fillRect(0, 0, size, size);
    
    // Circle - primary blue
    ctx.fillStyle = '#1095c1';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/3, 0, 2 * Math.PI);
    ctx.fill();
    
    // Text - "HS"
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${size/3}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HS', size/2, size/2);
    
    return canvas.toBuffer('image/png');
}

// Generate icons
const icon192 = generateIcon(192);
const icon512 = generateIcon(512);

// Save to static folder
writeFileSync(join(process.cwd(), 'static', 'icon-192.png'), icon192);
writeFileSync(join(process.cwd(), 'static', 'icon-512.png'), icon512);

console.log('Icons generated successfully!');
