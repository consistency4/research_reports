function normalizeTitle(title) {
  return title.toLowerCase().replace(/\W+/g, " ").trim();
}

function titleSimilarity(a, b) {
  const wordsA = new Set(normalizeTitle(a).split(" ").filter(Boolean));
  const wordsB = new Set(normalizeTitle(b).split(" ").filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.max(wordsA.size, wordsB.size);
}

export function dedupeInsights(insights, similarityThreshold = 0.7) {
  const kept = [];

  for (const insight of insights) {
    const duplicate = kept.find(
      (k) => titleSimilarity(k.title, insight.title) >= similarityThreshold,
    );

    if (!duplicate) {
      kept.push(insight);
      continue;
    }

    if ((insight.confidence ?? 0) > (duplicate.confidence ?? 0)) {
      const idx = kept.indexOf(duplicate);
      kept[idx] = insight;
    }
  }

  return kept;
}
