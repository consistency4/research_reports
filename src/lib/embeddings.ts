const EMBEDDING_DIM = 384;

export function textToEmbedding(text: string, dim = EMBEDDING_DIM): number[] {
  const vec = new Float32Array(dim);

  for (const token of tokenize(text)) {
    const h = hashToken(token);
    const idx = Math.abs(h) % dim;
    const sign = h & 1 ? 1 : -1;
    vec[idx] += sign;
  }

  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return Array.from(vec, (v) => v / norm);
}

export function parseEmbedding(value: unknown): number[] | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.every((n) => typeof n === "number") ? (value as number[]) : null;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
        return parsed;
      }
    } catch {
      const trimmed = value.replace(/^\[/, "").replace(/\]$/, "");
      if (!trimmed) return null;
      const nums = trimmed.split(",").map((n) => Number(n.trim()));
      if (nums.every((n) => !Number.isNaN(n))) return nums;
    }
  }
  return null;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
}

function hashToken(token: string): number {
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = ((h << 5) - h + token.charCodeAt(i)) | 0;
  }
  return h;
}

export { EMBEDDING_DIM };
