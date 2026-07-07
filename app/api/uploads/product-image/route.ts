import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/security";
import { safeErrorResponse, warnInDevelopment } from "@/lib/server/errors";
import { uploadProductImageForCurrentEnvironment } from "@/lib/server/product-image-storage";

export const runtime = "nodejs";

const maxFileSize = 4 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const signatures: Record<string, { extension: string; matches: (bytes: Uint8Array) => boolean }> = {
  "image/jpeg": {
    extension: "jpg",
    matches: (bytes) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  },
  "image/png": {
    extension: "png",
    matches: (bytes) =>
      bytes.length > 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
  },
  "image/webp": {
    extension: "webp",
    matches: (bytes) =>
      bytes.length > 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  }
};

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Envie uma imagem válida." }, { status: 422 });
    }

    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ error: "Formato inválido. Use JPG, PNG ou WEBP." }, { status: 422 });
    }

    if (file.size <= 0 || file.size > maxFileSize) {
      return NextResponse.json({ error: "A imagem precisa ter até 4 MB." }, { status: 422 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const signature = signatures[file.type];
    if (!signature?.matches(buffer)) {
      return NextResponse.json({ error: "O arquivo não parece ser uma imagem válida." }, { status: 422 });
    }

    const storedImage = await uploadProductImageForCurrentEnvironment({
      buffer,
      contentType: file.type as "image/jpeg" | "image/png" | "image/webp",
      extension: signature.extension as "jpg" | "png" | "webp"
    });

    return NextResponse.json({
      data: {
        imageUrl: storedImage.imageUrl,
        storagePath: storedImage.storagePath,
        bucket: storedImage.bucket,
        contentType: file.type,
        size: file.size
      }
    }, { status: 201 });
  } catch (error) {
    warnInDevelopment("Product image upload failed", error);
    if (error instanceof Error && error.message === "Armazenamento de imagens não configurado.") {
      return safeErrorResponse(error.message, 503);
    }
    return safeErrorResponse("Não foi possível salvar a imagem do produto.");
  }
}
