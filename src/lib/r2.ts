/**
 * Cloudflare R2 upload helper for serverless environments
 * Uses import.meta.env instead of process.env/dotenv
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const R2_PUBLIC_URL = 'https://pub-29ede69a4da644b9b81fa3dd5f8e9d6a.r2.dev'

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
  const accountId = import.meta.env.CLOUDFLARE_ACCOUNT_ID
  const accessKeyId = import.meta.env.CLOUDFLARE_ACCESS_KEY_ID
  const secretAccessKey = import.meta.env.CLOUDFLARE_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing Cloudflare R2 env vars (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY)')
  }

  return new S3Client({
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    region: 'auto',
  })
}

/**
 * Upload a buffer to R2 and return the public URL
 */
export async function uploadBufferToR2(
  buffer: Buffer | Uint8Array,
  targetFilename: string
): Promise<string> {
  const client = getS3Client()
  const bucket = import.meta.env.CLOUDFLARE_BUCKET_2 || import.meta.env.CLOUDFLARE_BUCKET || 'kokomo-images'

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: targetFilename,
      Body: buffer instanceof Buffer ? buffer : Buffer.from(buffer),
      ContentType: getContentType(targetFilename),
    })
  )

  return `${R2_PUBLIC_URL}/${targetFilename}`
}
