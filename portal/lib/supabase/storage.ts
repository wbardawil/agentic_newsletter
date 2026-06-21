import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET_NAME = "edition-assets";

/**
 * Uploads a file to the edition-assets Supabase storage bucket.
 *
 * @param path - The destination path in the bucket (e.g., `2024-28/hero.png`).
 * @param body - The file content to upload.
 * @param contentType - The MIME type of the file.
 * @returns The publicly-accessible URL of the uploaded file.
 * @throws If the upload fails.
 */
export async function uploadAsset(path: string, body: Buffer, contentType: string): Promise<string> {
  const supabase = await getSupabaseAdminClient();

  // Check if the bucket exists. In a real app, you might want to ensure this
  // happens at startup or via infrastructure-as-code.
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    throw new Error(`Storage error: ${bucketError.message}`);
  }
  if (!buckets.find((b) => b.name === BUCKET_NAME)) {
    // In a production scenario, we'd likely use more constrained permissions.
    await supabase.storage.createBucket(BUCKET_NAME, { public: true });
  }

  // Upload the file. `upsert: true` means it will overwrite if it exists.
  const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(path, body, {
    contentType,
    upsert: true,
  });

  if (uploadError) {
    throw new Error(`Failed to upload asset to ${path}: ${uploadError.message}`);
  }

  // Retrieve the public URL.
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);

  if (!data || !data.publicUrl) {
    // This should not happen if the upload succeeded, but we check just in case.
    throw new Error(`Could not retrieve public URL for ${path}`);
  }

  return data.publicUrl;
}
