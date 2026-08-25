export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
export const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";

type ServiceAccountCredentials = {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
};

function base64Url(value: string | ArrayBuffer) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function privateKeyBytes(pem: string) {
  const encoded = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
}

export async function createServiceAccountAssertion(rawCredentials: string, now = Date.now()) {
  let credentials: ServiceAccountCredentials;
  try {
    credentials = JSON.parse(rawCredentials);
  } catch {
    return null;
  }
  const email = credentials.client_email ?? "";
  const privateKey = credentials.private_key ?? "";
  const tokenUri = GOOGLE_TOKEN_URI;
  if (!email || !privateKey) return null;

  const issuedAt = Math.floor(now / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: email,
    scope: GOOGLE_ADS_SCOPE,
    aud: tokenUri,
    iat: issuedAt,
    exp: issuedAt + 3600,
  }));
  const signingInput = `${header}.${claims}`;
  try {
    const key = await crypto.subtle.importKey(
      "pkcs8",
      privateKeyBytes(privateKey),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(signingInput),
    );
    return { assertion: `${signingInput}.${base64Url(signature)}`, tokenUri };
  } catch {
    return null;
  }
}
