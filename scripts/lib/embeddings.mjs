const EMBEDDING_DIM = 384;

export function parseEmbedding(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      const trimmed = value.replace(/^\[/, "").replace(/\]$/, "");
      if (!trimmed) return null;
      return trimmed.split(",").map((n) => Number(n.trim()));
    }
  }
  return null;
}

export function textToEmbedding(text, dim = EMBEDDING_DIM) {
  const vec = new Float32Array(dim);
  const tokens = text.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  for (const token of tokens) {
    let h = 0;
    for (let i = 0; i < token.length; i++) h = ((h << 5) - h + token.charCodeAt(i)) | 0;
    const idx = Math.abs(h) % dim;
    vec[idx] += h & 1 ? 1 : -1;
  }
  const norm = Math.sqrt([...vec].reduce((s, v) => s + v * v, 0)) || 1;
  return [...vec].map((v) => v / norm);
}

export { EMBEDDING_DIM };
