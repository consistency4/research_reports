const SINGLE_PASS_LIMIT = 90_000;
const CHUNK_SIZE = 55_000;
const CHUNK_OVERLAP = 4_000;

export function needsChunking(text) {
  return text.length > SINGLE_PASS_LIMIT;
}

export function chunkText(text) {
  if (!needsChunking(text)) {
    return [{ index: 0, total: 1, text }];
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);

    if (end < text.length) {
      const breakAt = text.lastIndexOf("\n\n", end);
      if (breakAt > start + CHUNK_SIZE * 0.5) end = breakAt;
    }

    chunks.push(text.slice(start, end));

    if (end >= text.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks.map((text, index) => ({
    index,
    total: chunks.length,
    text,
  }));
}

export { SINGLE_PASS_LIMIT, CHUNK_SIZE, CHUNK_OVERLAP };
