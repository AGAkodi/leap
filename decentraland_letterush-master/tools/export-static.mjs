import { execSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const rawUrl =
  process.env.BASE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  'https://letterush.vercel.app'

const baseUrl = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))
  ? rawUrl.replace(/\/+$/, '')
  : `https://${rawUrl.replace(/\/+$/, '')}`

console.log(`Exporting static Decentraland realm with baseUrl: ${baseUrl}`)

execSync(
  `npx sdk-commands export-static --dir . --destination dist --realmName letterush --baseUrl "${baseUrl}"`,
  { stdio: 'inherit' }
)

// Ensure /about is also accessible at root /about as well as /letterush/about
const aboutSrc = resolve('dist/letterush/about')
if (existsSync(aboutSrc)) {
  copyFileSync(aboutSrc, resolve('dist/about'))
  console.log('Copied realm descriptor to dist/about')
}

const landingSrc = resolve('static/index.html')
const landingDst = resolve('dist/index.html')
if (existsSync(landingSrc)) {
  copyFileSync(landingSrc, landingDst)
  console.log(`Copied landing page to ${landingDst}`)
}
