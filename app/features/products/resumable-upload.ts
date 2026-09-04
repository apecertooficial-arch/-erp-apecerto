import { Upload } from "tus-js-client";

type ResumableUploadInput = {
  accessToken: string;
  bucketName: string;
  file: File;
  objectName: string;
  onProgress?: (percentage: number) => void;
};

function resumableEndpoints(projectUrl: string) {
  const parsed = new URL(projectUrl);
  const directHost = parsed.hostname.endsWith(".supabase.co")
    ? parsed.hostname.replace(".supabase.co", ".storage.supabase.co")
    : parsed.hostname;
  const gateway = `${parsed.protocol}//${parsed.host}/storage/v1/upload/resumable`;
  const direct = `${parsed.protocol}//${directHost}/storage/v1/upload/resumable`;
  return Array.from(new Set([gateway, direct]));
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
  let hash = "";
  try {
    if (!globalThis.crypto?.subtle) throw new Error("Web Crypto indisponível");
    const digest = await globalThis.crypto.subtle.digest("SHA-256", signature);
    hash = Array.from(new Uint8Array(digest)).slice(0, 12).map((value) => value.toString(16).padStart(2, "0")).join("");
  } catch {
    // Alguns WebViews Android desabilitam Web Crypto. O hash não precisa ser
    // criptográfico: ele só mantém o caminho estável para retomar sem duplicar.
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    for (const value of signature) {
      first = Math.imul(first ^ value, 0x01000193) >>> 0;
      second = Math.imul(second ^ (value + 0x9d), 0x85ebca6b) >>> 0;
    }
    hash = `${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}${file.size.toString(16).padStart(8, "0")}`;
  }
  const scope = unitId ? `unidades/${unitId}` : "produto";
  return `${userId}/${productId}/${scope}/${hash}-${safeFileName(file.name)}`;
}

function uploadAtEndpoint(endpoint: string, { accessToken, bucketName, file, objectName, onProgress }: ResumableUploadInput) {
  return new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint,
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
      // Cria a sessão primeiro e envia o conteúdo em PATCH. Assim uma queda no
      // meio do primeiro pedido também pode ser retomada no celular.
      uploadDataDuringCreation: false,
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
      const endpointOrigin = new URL(endpoint).origin;
      const compatibleUpload = previousUploads.find((previous) => {
        try { return new URL(previous.uploadUrl).origin === endpointOrigin; }
        catch { return false; }
      });
      if (compatibleUpload) upload.resumeFromPreviousUpload(compatibleUpload);
      upload.start();
    }).catch((error) => {
      // Retomada é uma otimização, não uma condição para enviar. Em alguns
      // Androids/PWAs o armazenamento local pode estar bloqueado ou corrompido.
      console.warn("[produto-upload] Retomada local indisponível; iniciando envio novo.", error);
      upload.start();
    });
  });
}

export async function uploadProductMediaResumable(input: ResumableUploadInput) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) throw new Error("O endereço do armazenamento não está configurado.");

  const failures: unknown[] = [];
  for (const endpoint of resumableEndpoints(projectUrl)) {
    try {
      await uploadAtEndpoint(endpoint, input);
      return;
    } catch (error) {
      failures.push(error);
      console.warn("[produto-upload] Endpoint indisponível; tentando rota alternativa.", {
        endpoint: new URL(endpoint).host,
        error,
      });
    }
  }

  const lastFailure = failures.at(-1);
  const detail = lastFailure instanceof Error && lastFailure.message
    ? ` (${lastFailure.message})`
    : "";
  throw new Error(`A conexão com o armazenamento falhou nas duas rotas${detail}. Tente novamente; as fotos já concluídas não serão duplicadas.`);
}
