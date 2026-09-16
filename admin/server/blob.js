import { del, head, list, put } from '@vercel/blob'

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || ''

export function hasBlob() {
  return Boolean(TOKEN)
}

export async function putBlobObject(pathname, buffer, contentType) {
  return put(pathname, buffer, {
    access: 'public',
    addRandomSuffix: false,
    contentType: contentType || 'application/octet-stream',
    token: TOKEN
  })
}

export async function headBlobObject(pathname) {
  try {
    return await head(pathname, { token: TOKEN })
  } catch (error) {
    if (error?.name === 'BlobNotFoundError' || error?.status === 404) return null
    throw error
  }
}

export async function listBlobObjects(prefix) {
  const result = await list({ prefix, limit: 1000, token: TOKEN })
  return result.blobs || []
}

export async function deleteBlobObject(pathname) {
  await del(pathname, { token: TOKEN })
}
