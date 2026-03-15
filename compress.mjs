import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const assetsDir = path.resolve('src/assests/onboarding');
const files = ['splash-1.jpg', 'splash-2.jpg', 'splash-3.jpg', 'logincover.jpg', 'signupcover.jpg'];

async function compress() {
  for (const file of files) {
    const inputPath = path.join(assetsDir, file);
    const outputPath = path.join(assetsDir, file.replace('.jpg', '.webp'));
    
    if (fs.existsSync(inputPath)) {
      console.log(`Compressing ${file}...`);
      await sharp(inputPath)
        .resize({ width: 1080 }) // resize to a sensible max width for mobile phones
        .webp({ quality: 80 })  // 80% quality WebP
        .toFile(outputPath);
      console.log(`✅ Created ${file.replace('.jpg', '.webp')}`);
    } else {
      console.error(`❌ Could not find ${file}`);
    }
  }
}

compress().catch(console.error);
