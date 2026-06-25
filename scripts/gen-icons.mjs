// Génère les icônes PWA + le logo-mark à partir de branding/logo-source.png.
// Fond BLANC conservé (pas de détourage). Lance : node scripts/gen-icons.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUB = resolve(__dirname, '../src/renderer/public')
const SRC = resolve(__dirname, '../branding/logo-source.png')
const BG = '#ffffff'

// Bande AU-DESSUS du wordmark "NEUROBOOST" (source 2816×1536), puis trim du
// blanc pour isoler automatiquement le cerveau + la flèche.
const BAND = { left: 0, top: 0, width: 2816, height: 970 }

async function main() {
  const band = await sharp(SRC).extract(BAND).png().toBuffer()
  // trim tolérant (le fond est blanc cassé avec un léger dégradé/ombre)
  const brain = await sharp(band).trim({ background: BG, threshold: 40 }).png().toBuffer()

  // Icône = cerveau sur fond blanc, centré avec une marge (safe zone)
  async function icone(size, ratio, file) {
    const inner = Math.round(size * ratio)
    const b = await sharp(brain)
      .resize({ width: inner, height: inner, fit: 'contain', background: BG })
      .toBuffer()
    await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
      .composite([{ input: b, gravity: 'center' }])
      .png()
      .toFile(resolve(PUB, file))
  }

  await icone(512, 0.84, 'pwa-512x512.png')
  await icone(192, 0.84, 'pwa-192x192.png')
  await icone(512, 0.72, 'pwa-maskable-512x512.png') // safe zone maskable
  await icone(180, 0.84, 'apple-touch-icon.png')
  await icone(48, 0.86, 'favicon.png')
  await icone(128, 0.82, 'logo-mark.png') // pastille blanche pour la sidebar

  console.log('icônes générées (fond blanc) dans public/')
}

main().catch((e) => { console.error(e); process.exit(1) })
