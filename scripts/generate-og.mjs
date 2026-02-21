/**
 * Generate OGP images (1200x630) as PNG files using Canvas.
 * Run: node scripts/generate-og.mjs
 */
import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'og');
mkdirSync(outDir, { recursive: true });

const W = 1200;
const H = 630;

function drawFileIcon(ctx, x, y, size, color = '#fff') {
  const s = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'transparent';

  // File body
  ctx.beginPath();
  ctx.moveTo(15, 2);
  ctx.lineTo(6, 2);
  ctx.arcTo(4, 2, 4, 4, 2);
  ctx.lineTo(4, 22);
  ctx.arcTo(4, 24, 6, 24, 2);
  ctx.lineTo(18, 24);
  ctx.arcTo(20, 24, 20, 22, 2);
  ctx.lineTo(20, 7);
  ctx.closePath();
  ctx.stroke();

  // Fold
  ctx.beginPath();
  ctx.moveTo(14, 2);
  ctx.lineTo(14, 6);
  ctx.arcTo(14, 8, 16, 8, 2);
  ctx.lineTo(20, 8);
  ctx.stroke();

  // Checkmark
  ctx.beginPath();
  ctx.moveTo(9, 15);
  ctx.lineTo(11, 17);
  ctx.lineTo(15, 13);
  ctx.stroke();

  ctx.restore();
}

function createGradient(ctx) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#1e40af');
  grad.addColorStop(0.5, '#2563eb');
  grad.addColorStop(1, '#3b82f6');
  return grad;
}

function drawBase(ctx) {
  // Background gradient
  ctx.fillStyle = createGradient(ctx);
  ctx.fillRect(0, 0, W, H);

  // Subtle pattern dots
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let x = 0; x < W; x += 40) {
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawLogo(ctx, centerX, y) {
  // Icon
  drawFileIcon(ctx, centerX - 130, y - 18, 40, '#fff');

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('OpenedFile', centerX - 80, y + 14);
}

// --- Default OGP ---
function generateDefault() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  drawBase(ctx);

  // Logo
  drawLogo(ctx, W / 2, 220);

  // Tagline
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '28px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Open Any File, Right in Your Browser', W / 2, 310);

  // Subtitle
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '20px Inter, sans-serif';
  ctx.fillText('Free  ·  Private  ·  No Upload Required', W / 2, 360);

  // Bottom bar
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, H - 60, W, 60);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText('openedfile.com', W / 2, H - 28);

  writeFileSync(join(outDir, 'default.png'), canvas.toBuffer('image/png'));
  console.log('Created: public/og/default.png');
}

// --- Tool OGP ---
function generateToolOG(filename, toolName, toolDesc) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  drawBase(ctx);

  // Logo (smaller, top area)
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '22px Inter, sans-serif';
  ctx.textAlign = 'center';
  drawFileIcon(ctx, W / 2 - 80, 140, 28, 'rgba(255,255,255,0.7)');
  ctx.fillText('OpenedFile', W / 2 + 10, 160);

  // Tool name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(toolName, W / 2, 280);

  // Tool description
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '24px Inter, sans-serif';
  ctx.fillText(toolDesc, W / 2, 340);

  // Badge
  const badgeText = 'No Upload · 100% Browser-Based';
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  const badgeW = 380;
  const badgeH = 36;
  const badgeX = (W - badgeW) / 2;
  const badgeY = 380;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 18);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '15px Inter, sans-serif';
  ctx.fillText(badgeText, W / 2, badgeY + 24);

  // Bottom bar
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, H - 60, W, 60);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText('openedfile.com', W / 2, H - 28);

  writeFileSync(join(outDir, filename), canvas.toBuffer('image/png'));
  console.log(`Created: public/og/${filename}`);
}

try {
  generateDefault();
  generateToolOG('webp.png', 'WebP to JPG/PNG Converter', 'Convert WebP images instantly in your browser');
  generateToolOG('heic.png', 'HEIC to JPG/PNG Converter', 'Convert iPhone HEIC photos to JPG or PNG');
  generateToolOG('winmail.png', 'Winmail.dat Viewer', 'Open and extract winmail.dat attachments');
  console.log('\nAll OGP images generated successfully!');
} catch (e) {
  console.error('Error generating OGP images:', e.message);
  console.log('\nFalling back to SVG-based OGP generation...');
  // Fallback: create simple SVG files and note they need manual conversion
  process.exit(1);
}
