#!/usr/bin/env npx tsx
/**
 * Upload a local image to Cloudflare R2
 *
 * Usage as CLI:
 *   npx tsx pipeline/upload-to-r2.ts <local-file-path> <target-filename>
 *
 * Usage as module:
 *   import { uploadToR2 } from './upload-to-r2'
 *   const url = await uploadToR2('/path/to/file.webp', 'my-post-header.webp')
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { config } from 'dotenv'

// Load env
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const R2_PUBLIC_URL =
  process.env.CLOUDFLARE_R2_URL ||
  'https://pub-29ede69a4da644b9b81fa3dd5f8e9d6a.r2.dev'

function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const types: Record<string, string> = {
    webp: 'image/webp',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    avif: 'image/avif',
  }
  return types[ext] || 'application/octet-stream'
}

function getS3Client(): S3Client {
  const requiredVars = [
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_ACCESS_KEY_ID',
    'CLOUDFLARE_SECRET_ACCESS_KEY',
  ]
  for (const v of requiredVars) {
    if (!process.env[v]) {
      throw new Error(`Missing env var: ${v}. Check .env.local`)
    }
  }

  return new S3Client({
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
    },
    region: 'auto',
  })
}

/**
 * Upload a file buffer to R2
 */
export async function uploadBufferToR2(
  buffer: Buffer,
  targetFilename: string
): Promise<string> {
  const client = getS3Client()
  const bucket = process.env.CLOUDFLARE_BUCKET_2 || process.env.CLOUDFLARE_BUCKET || 'kokomo-images'

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: targetFilename,
      Body: buffer,
      ContentType: getContentType(targetFilename),
      CacheControl: 'public, max-age=31536000, immutable',
    })
  )

  return `${R2_PUBLIC_URL}/${targetFilename}`
}

/**
 * Upload a local file to R2
 */
export async function uploadToR2(
  localPath: string,
  targetFilename: string
): Promise<string> {
  const resolvedPath = resolve(localPath)
  if (!existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`)
  }

  const buffer = readFileSync(resolvedPath) as Buffer
  const url = await uploadBufferToR2(buffer, targetFilename)
  return url
}

// CLI mode
if (process.argv[1]?.includes('upload-to-r2')) {
  ;(async () => {
    const [, , localPath, targetFilename] = process.argv

    if (!localPath || !targetFilename) {
      console.error('Usage: npx tsx pipeline/upload-to-r2.ts <local-file> <target-filename>')
      console.error('Example: npx tsx pipeline/upload-to-r2.ts ~/img.webp mein-post-header.webp')
      process.exit(1)
    }

    try {
      const url = await uploadToR2(localPath, targetFilename)
      console.log(`✅ Uploaded: ${url}`)
    } catch (err: any) {
      console.error(`❌ Upload failed: ${err.message}`)
      process.exit(1)
    }
  })()
}
