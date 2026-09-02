import { Upload } from "tus-js-client";

type ResumableUploadInput = {
  accessToken: string;
  bucketName: string;
  file: File;
  objectName: string;
  onProgress?: (percentage: number) => void;
};

function resumableEndpoint(projectUrl: string) {
  const parsed = new URL(projectUrl);
  const directHost = parsed.hostname.endsWith(".supabase.co")
    ? parsed.hostname.replace(".supabase.co", ".storage.supabase.co")
    : parsed.hostname;
  return `${parsed.protocol}//${directHost}/storage/v1/upload/resumable`;
}

function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
}

/**
 * Gera o mesmo objeto quando a corretora seleciona novamente o mesmo arquivo.
 * Isso permite que o TUS retome o envio e que o registro em `midias` seja
 * idempotente mesmo depois de fechar e reabrir o app.
 */
export async function buildProductMediaPath(userId: string, productId: string, unitId: string | null, file: File) {
  const metadata = new TextEncoder().encode(`${file.name}\n${file.type}\n${file.size}\n${file.lastModified}\n${unitId ?? "produto"}`);
  const sampleSize = 64 * 1024;
  const firstBytes = new Uint8Array(await file.slice(0, sampleSize).arrayBuffer());
  const lastBytes = new Uint8Array(await file.slice(Math.max(0, file.size - sampleSize)).arrayBuffer());
  const signature = new Uint8Array(metadata.length + firstBytes.length + lastBytes.length);
  signature.set(metadata);
  signature.set(firstBytes, metadata.length);
  signature.set(lastBytes, metadata.length + firstBytes.length);
  const digest = await crypto.subtle.digest("SHA-256", signature);
  const hash = Array.from(new Uint8Array(digest)).slice(0, 12).map((value) => value.toString(16).padStart(2, "0")).join("");
  const scope = unitId ? `unidades/${unitId}` : "produto";
  return `${userId}/${productId}/${scope}/${hash}-${safeFileName(file.name)}`;
}

export async function uploadProductMediaResumable({ accessToken, bucketName, file, objectName, onProgress }: ResumableUploadInput) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) throw new Error("O endereço do armazenamento não está configurado.");

  return new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: resumableEndpoint(projectUrl),
      retryDelays: [0, 1000, 3000, 5000, 10000],
      fingerprint: async (inputFile, options) => [
        "apecerto-produto",
        inputFile.name,
        inputFile.type,
        inputFile.size,
        inputFile.lastModified,
        options.metadata?.objectName ?? objectName,
      ].join("-"),
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName,
        objectName,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      onError: (error) => reject(error),
      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress?.(bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0);
      },
      onSuccess: () => resolve(),
    });

    void upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) upload.resumeFromPreviousUpload(previousUploads[0]);
      upload.start();
    }).catch(reject);
  });
}
