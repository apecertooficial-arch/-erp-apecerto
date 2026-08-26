type ProductImageErrorEvent = {
  currentTarget: HTMLImageElement;
};

export function nextProductMediaRetryUrl(source: string, timestamp = Date.now()): string | null {
  if (!source || /(?:[?&])erp_retry=/.test(source)) return null;
  return `${source}${source.includes("?") ? "&" : "?"}erp_retry=${timestamp}`;
}

export function retryProductMediaImage(event: ProductImageErrorEvent): void {
  const image = event.currentTarget;
  const retryUrl = nextProductMediaRetryUrl(image.src);
  if (retryUrl) {
    image.src = retryUrl;
    return;
  }
  image.dataset.failed = "1";
  image.alt = "Foto temporariamente indisponível";
}
