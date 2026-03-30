#!/usr/bin/env npx tsx
/**
 * Re-compress all titelbild images in R2 with optimized quality.
 * Downloads each titelbild, re-encodes with sharp at quality 75, re-uploads.
 *
 * Usage: npx tsx pipeline/recompress-titelbilder.ts [--dry-run]
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { resolve } from 'path'
import { config } from 'dotenv'
import sharp from 'sharp'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const QUALITY = 75
const MAX_WIDTH = 1200
const MAX_HEIGHT = 675
const dryRun = process.argv.includes('--dry-run')

;(async () => {
  const bucket = process.env.CLOUDFLARE_BUCKET_2 || process.env.CLOUDFLARE_BUCKET || 'kokomo-images'

  const client = new S3Client({
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
    },
    region: 'auto',
  })

  let continuationToken: string | undefined
  let processed = 0
  let saved = 0

  do {
    const list = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken })
    )

    for (const obj of list.Contents || []) {
      if (!obj.Key || !obj.Key.includes('titelbild') || !obj.Key.endsWith('.webp')) continue

      const originalSize = obj.Size || 0
      if (originalSize < 30_000) continue // Skip already small images

      try {
        // Download
        const getResult = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: obj.Key })
        )
        const chunks: Uint8Array[] = []
        for await (const chunk of getResult.Body as any) {
          chunks.push(chunk)
        }
        const buffer = Buffer.concat(chunks)

        // Re-compress with sharp
        const optimized = await sharp(buffer)
          .resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: QUALITY })
          .toBuffer()

        const reduction = ((1 - optimized.length / buffer.length) * 100).toFixed(1)

        if (optimized.length >= buffer.length) {
          console.log(`⏭️  ${obj.Key}: ${(buffer.length / 1024).toFixed(0)}KB → already optimal`)
          continue
        }

        if (dryRun) {
          console.log(`🔍 ${obj.Key}: ${(buffer.length / 1024).toFixed(0)}KB → ${(optimized.length / 1024).toFixed(0)}KB (-${reduction}%)`)
        } else {
          await client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: obj.Key,
              Body: optimized,
              ContentType: 'image/webp',
              CacheControl: 'public, max-age=31536000, immutable',
            })
          )
          console.log(`✅ ${obj.Key}: ${(buffer.length / 1024).toFixed(0)}KB → ${(optimized.length / 1024).toFixed(0)}KB (-${reduction}%)`)
          saved += buffer.length - optimized.length
        }
        processed++
      } catch (err: any) {
        console.error(`❌ ${obj.Key}: ${err.message}`)
      }
    }

    continuationToken = list.NextContinuationToken
  } while (continuationToken)

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Done: ${processed} titelbilder processed, ${(saved / 1024).toFixed(0)}KB saved`)
})()
