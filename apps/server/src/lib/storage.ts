import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

let _client: S3Client | null = null

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      // Required for MinIO and other S3-compatible services
      forcePathStyle: true,
    })
  }
  return _client
}

function bucket() {
  return process.env.R2_BUCKET || 'formbase-pdfs'
}

export function makePdfKey(orgId: string, docId: string): string {
  return `orgs/${orgId}/docs/${docId}/original.pdf`
}

export async function uploadPdf(key: string, buffer: ArrayBuffer): Promise<void> {
  await getClient().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: new Uint8Array(buffer),
    ContentType: 'application/pdf',
  }))
}

export async function getPdfSignedUrl(key: string): Promise<string> {
  return getSignedUrl(getClient(), new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
  }), { expiresIn: 3600 })
}

export async function deletePdf(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({
    Bucket: bucket(),
    Key: key,
  }))
}
