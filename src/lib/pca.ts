import { PCA } from "ml-pca";

export type Point3D = { x: number; y: number; z: number };

export function reduceTo3D(vectors: number[][]): Point3D[] {
  if (vectors.length === 0) return [];
  if (vectors.length === 1) return [{ x: 0, y: 0, z: 0 }];

  const dims = Math.min(3, vectors[0].length, vectors.length);
  const pca = new PCA(vectors);
  const projected = pca.predict(vectors, { nComponents: dims });

  return projected.to2DArray().map((row) => ({
    x: row[0] ?? 0,
    y: row[1] ?? 0,
    z: row[2] ?? 0,
  }));
}
