export function normalizeEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  return email.includes("@") && email.length <= 254 ? email : "";
}

export function normalizeBrazilPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return "";
}

export async function sha256Hex(value) {
  const data = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isAcceptedReceipt(responseOk, numReceived, numInvalidEntries, expectedRows) {
  return responseOk === true
    && Number.isInteger(numReceived)
    && numReceived === expectedRows
    && numInvalidEntries === 0;
}

export async function buildHashedBatches(rows) {
  const both = [];
  const phoneOnly = [];
  const emailOnly = [];

  for (const row of rows) {
    const email = normalizeEmail(row.email);
    const phone = normalizeBrazilPhone(row.phone);
    if (!phone && !email) continue;

    if (email && phone) {
      both.push({
        lead_id: Number(row.lead_id),
        values: [await sha256Hex(email), await sha256Hex(phone)],
      });
    } else if (phone) {
      phoneOnly.push({ lead_id: Number(row.lead_id), values: [await sha256Hex(phone)] });
    } else if (email) {
      emailOnly.push({ lead_id: Number(row.lead_id), values: [await sha256Hex(email)] });
    }
  }

  return [
    both.length ? { schema: ["EMAIL_SHA256", "PHONE_SHA256"], rows: both } : null,
    phoneOnly.length ? { schema: ["PHONE_SHA256"], rows: phoneOnly } : null,
    emailOnly.length ? { schema: ["EMAIL_SHA256"], rows: emailOnly } : null,
  ].filter(Boolean);
}
