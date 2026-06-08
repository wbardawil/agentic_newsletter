import { createClient } from "@supabase/supabase-js";

const BUCKET = "edition-assets";

/**
 * Upload an edition image asset to Supabase Storage.
 * Returns the public URL of the uploaded asset.
 * Path pattern: `edition-assets/<editionId>/hero-v<attempt>.<ext>`
 */
export async function uploadEditionAsset(
  supabaseUrl: string,
  supabaseKey: string,
  editionId: string,
  attempt: number,
  imageBuffer: Buffer,
  mimeType: "image/png" | "image/jpeg" = "image/png",
): Promise<string> {
  const ext = mimeType === "image/png" ? "png" : "jpg";
  const path = `${editionId}/hero-v${attempt}.${ext}`;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, imageBuffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed for ${path}: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
