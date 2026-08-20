/**
 * Massive flat files — S3-compatible bulk historical data. Server only.
 *
 * Flat files are Massive's *historical* channel: daily gzipped CSV objects in
 * an S3 bucket. They are perfect for long-range peg backtests and useless for
 * live ticks (that is the REST API in massive.server.ts).
 *
 * Signing is plain AWS SigV4 over Web Crypto so it runs in the edge worker with
 * no SDK. Credentials come from project secrets and never leave the server.
 */

const enc = new TextEncoder();

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const sha256 = async (data: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(data)));

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}

type Creds = { keyId: string; secret: string; endpoint: string; bucket: string; region: string };

export function flatFilesCreds(): Creds | null {
  const keyId = process.env["MASSIVE_ACCESS_KEY_ID"];
  const secret = process.env["MASSIVE_SECRET_ACCESS_KEY"];
  if (!keyId || !secret) return null;
  return {
    keyId,
    secret,
    endpoint: (process.env["MASSIVE_S3_ENDPOINT"] ?? "https://files.massive.com").replace(/\/+$/, ""),
    bucket: process.env["MASSIVE_BUCKET"] ?? "flatfiles",
    region: process.env["MASSIVE_S3_REGION"] ?? "us-east-1",
  };
}

export const flatFilesConfigured = () => flatFilesCreds() !== null;

/** Signed GET against the flat-files bucket. `path` is the object key or "" for a listing. */
async function signedGet(path: string, query: Record<string, string> = {}): Promise<Response> {
  const creds = flatFilesCreds();
  if (!creds) throw new Error("Massive flat-file credentials are not configured");

  const url = new URL(`${creds.endpoint}/${creds.bucket}/${path}`.replace(/([^:]\/)\/+/g, "$1"));
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k] ?? "")}`)
    .join("&");
  url.search = canonicalQuery;

  const now = new Date();
  const amzDate = `${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256("");

  const canonicalPath = url.pathname
    .split("/")
    .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
    .join("/");
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `GET\n${canonicalPath}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const scope = `${dateStamp}/${creds.region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256(canonicalRequest)}`;

  let key: ArrayBuffer | Uint8Array = enc.encode(`AWS4${creds.secret}`);
  for (const part of [dateStamp, creds.region, "s3", "aws4_request"]) key = await hmac(key, part);
  const signature = hex(await hmac(key, stringToSign));

  return fetch(url, {
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${creds.keyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
  });
}

/** Retries transient S3 failures (429/5xx/network) with backoff. */
async function signedGetRetrying(path: string, query: Record<string, string> = {}): Promise<Response> {
  let last: Response | Error | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
    try {
      const res = await signedGet(path, query);
      if (res.ok || (res.status < 500 && res.status !== 429)) return res;
      last = res;
    } catch (error) {
      last = error as Error;
    }
  }
  if (last instanceof Error) throw last;
  return last as Response;
}

/** ListObjectsV2 — returns object keys plus the common prefixes below `prefix`. */
export async function listFlatFiles(
  prefix: string,
  opts: { delimiter?: string; maxKeys?: number } = {},
): Promise<{ keys: string[]; prefixes: string[] }> {
  const res = await signedGetRetrying("", {
    "list-type": "2",
    prefix,
    "max-keys": String(opts.maxKeys ?? 200),
    ...(opts.delimiter ? { delimiter: opts.delimiter } : {}),
  });
  const xml = await res.text();
  if (!res.ok) throw new Error(`Massive flat files list failed [${res.status}]: ${xml.slice(0, 300)}`);
  const pick = (tag: string) =>
    Array.from(xml.matchAll(new RegExp(`<${tag}>([^<]+)</${tag}>`, "g"))).map((m) => m[1] as string);
  return { keys: pick("Key"), prefixes: pick("Prefix").filter((p) => p !== prefix) };
}

/** Downloads one flat file and returns its rows as records, transparently gunzipping. */
export async function readFlatFileCsv(key: string): Promise<Record<string, string>[]> {
  const res = await signedGetRetrying(key);
  if (!res.ok || !res.body) {
    throw new Error(`Massive flat file fetch failed [${res.status}] for ${key}`);
  }
  const stream = key.endsWith(".gz")
    ? res.body.pipeThrough(new DecompressionStream("gzip"))
    : res.body;
  const text = await new Response(stream).text();

  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const header = (lines.shift() ?? "").split(",").map((h) => h.trim());
  return lines.map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
}
