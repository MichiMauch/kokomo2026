#!/usr/bin/env npx tsx
/**
 * Fix Cache-Control headers on all existing R2 objects.
 * Uses CopyObject with MetadataDirective=REPLACE to update metadata in-place.
 *
 * Usage: npx tsx pipeline/fix-r2-cache-headers.ts
 */

import { S3Client, ListObjectsV2Command, CopyObjectCommand } from '@aws-sdk/client-s3'
import { resolve } from 'path'
import { config } from 'dotenv'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const CACHE_CONTROL = 'public, max-age=31536000, immutable'

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

  // List all objects
  let continuationToken: string | undefined
  let total = 0
  let updated = 0

  do {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    )

    for (const obj of list.Contents || []) {
      if (!obj.Key) continue
      total++

      try {
        await client.send(
          new CopyObjectCommand({
            Bucket: bucket,
            Key: obj.Key,
            CopySource: `${bucket}/${obj.Key}`,
            MetadataDirective: 'REPLACE',
            ContentType: getContentType(obj.Key),
            CacheControl: CACHE_CONTROL,
          })
        )
        updated++
        console.log(`✅ ${obj.Key}`)
      } catch (err: any) {
        console.error(`❌ ${obj.Key}: ${err.message}`)
      }
    }

    continuationToken = list.NextContinuationToken
  } while (continuationToken)

  console.log(`\nDone: ${updated}/${total} objects updated with Cache-Control: ${CACHE_CONTROL}`)
})()
