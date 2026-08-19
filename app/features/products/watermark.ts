const LOGO_URL = "/brand/logo-apecerto-branco.png";

let logoPromise: Promise<ImageBitmap> | null = null;

async function getLogo() {
  if (!logoPromise) {
    logoPromise = fetch(LOGO_URL)
      .then((response) => {
        if (!response.ok) throw new Error("Logo oficial indisponível.");
        return response.blob();
      })
      .then((blob) => createImageBitmap(blob));
  }
  return logoPromise;
}

/**
 * Grava a marca oficial no arquivo antes do upload. Assim a foto permanece
 * identificada também no site, no WhatsApp e quando for baixada.
 */
export async function applyOfficialWatermark(file: File) {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  try {
    const [photo, logo] = await Promise.all([createImageBitmap(file), getLogo()]);
    const canvas = document.createElement("canvas");
    canvas.width = photo.width;
    canvas.height = photo.height;
    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(photo, 0, 0);
    const logoWidth = Math.min(Math.max(140, Math.round(photo.width * 0.32)), Math.round(photo.width * 0.45));
    const logoHeight = Math.round(logoWidth * (logo.height / logo.width));
    context.save();
    context.globalAlpha = 0.7;
    context.shadowColor = "rgba(0,0,0,.58)";
    context.shadowBlur = Math.max(5, Math.round(photo.width * 0.004));
    context.shadowOffsetY = Math.max(2, Math.round(photo.width * 0.0015));
    context.drawImage(logo, Math.round((photo.width - logoWidth) / 2), Math.round((photo.height - logoHeight) / 2), logoWidth, logoHeight);
    context.restore();
    photo.close();

    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, 0.92));
    return blob ? new File([blob], file.name, { type: outputType, lastModified: file.lastModified }) : file;
  } catch (error) {
    console.warn("[marca-dagua] A foto original será mantida.", error);
    return file;
  }
}
