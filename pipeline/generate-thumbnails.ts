#!/usr/bin/env npx tsx
/**
 * Generate thumbnail variants of all titelbild images for responsive srcset.
 * Downloads each titelbild, resizes to 600px wide, uploads as *-thumb.webp.
 *
 * Usage: npx tsx pipeline/generate-thumbnails.ts [--dry-run]
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { resolve } from 'path'
import { config } from 'dotenv'
import sharp from 'sharp'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const THUMB_WIDTH = 600
const THUMB_QUALITY = 60
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
  let created = 0

  do {
    const list = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken })
    )

    for (const obj of list.Contents || []) {
      if (!obj.Key || !obj.Key.endsWith('-titelbild.webp')) continue

      const thumbKey = obj.Key.replace('-titelbild.webp', '-titelbild-thumb.webp')

      try {
        const getResult = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: obj.Key })
        )
        const chunks: Uint8Array[] = []
        for await (const chunk of getResult.Body as any) {
          chunks.push(chunk)
        }
        const buffer = Buffer.concat(chunks)

        const thumb = await sharp(buffer)
          .resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
          .webp({ quality: THUMB_QUALITY })
          .toBuffer()

        if (dryRun) {
          console.log(`🔍 ${obj.Key} → ${thumbKey}: ${(thumb.length / 1024).toFixed(0)}KB`)
        } else {
          await client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: thumbKey,
              Body: thumb,
              ContentType: 'image/webp',
              CacheControl: 'public, max-age=31536000, immutable',
            })
          )
          console.log(`✅ ${thumbKey}: ${(thumb.length / 1024).toFixed(0)}KB`)
        }
        created++
      } catch (err: any) {
        console.error(`❌ ${obj.Key}: ${err.message}`)
      }
    }

    continuationToken = list.NextContinuationToken
  } while (continuationToken)

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Done: ${created} thumbnails created`)
})()
