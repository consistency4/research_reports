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
