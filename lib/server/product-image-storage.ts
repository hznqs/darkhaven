import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type ProductImageUpload = {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

type StoredProductImage = {
  imageUrl: string;
  storagePath: string;
  bucket: string;
};

const defaultBucket = "product-images";
const maxFileSize = 4 * 1024 * 1024;
const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

export function getProductImagesBucket() {
  return process.env.SUPABASE_PRODUCT_IMAGES_BUCKET?.trim() || defaultBucket;
}

export function getProductImageStorageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = getProductImagesBucket();

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false as const,
      message: "Armazenamento de imagens não configurado."
    };
  }

  return {
    ok: true as const,
    supabaseUrl,
    serviceRoleKey,
    bucket
  };
}

export async function uploadProductImageToStorage(upload: ProductImageUpload): Promise<StoredProductImage> {
  const config = getProductImageStorageConfig();
  if (!config.ok) throw new Error(config.message);

  await ensureProductImagesBucket(config);

  const storagePath = `products/${randomUUID()}.${upload.extension}`;
  const uploadUrl = `${config.supabaseUrl}/storage/v1/object/${encodeURIComponent(config.bucket)}/${storagePath}`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": upload.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "x-upsert": "false"
    },
    body: upload.buffer
  });

  if (!response.ok) {
    throw new Error(`Falha ao gravar imagem no Storage. Status ${response.status}.`);
  }

  return {
    imageUrl: buildPublicProductImageUrl(config.supabaseUrl, config.bucket, storagePath),
    storagePath,
    bucket: config.bucket
  };
}

export async function uploadProductImageForCurrentEnvironment(upload: ProductImageUpload): Promise<StoredProductImage> {
  const config = getProductImageStorageConfig();
  if (config.ok) return uploadProductImageToStorage(upload);
  if (process.env.NODE_ENV === "production") throw new Error(config.message);

  return writeProductImageToLocalDev(upload);
}

async function ensureProductImagesBucket(config: { supabaseUrl: string; serviceRoleKey: string; bucket: string }) {
  const response = await fetch(`${config.supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id: config.bucket,
      name: config.bucket,
      public: true,
      file_size_limit: maxFileSize,
      allowed_mime_types: allowedMimeTypes
    })
  });

  if (response.ok || response.status === 409) return;

  const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
  const message = `${payload?.message ?? payload?.error ?? ""}`.toLowerCase();
  if (message.includes("already exists") || message.includes("duplicate")) return;

  throw new Error(`Falha ao preparar bucket de imagens. Status ${response.status}.`);
}

function buildPublicProductImageUrl(supabaseUrl: string, bucket: string, storagePath: string) {
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${storagePath}`;
}

async function writeProductImageToLocalDev(upload: ProductImageUpload): Promise<StoredProductImage> {
  const uploadsDir = path.join(process.cwd(), "public", "uploads", "products");
  await mkdir(uploadsDir, { recursive: true });

  const fileName = `${randomUUID()}.${upload.extension}`;
  const absolutePath = path.join(uploadsDir, fileName);
  await writeFile(absolutePath, upload.buffer, { flag: "wx" });

  return {
    imageUrl: `/uploads/products/${fileName}`,
    storagePath: `products/${fileName}`,
    bucket: "local-dev"
  };
}
