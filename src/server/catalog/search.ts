import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { normalizeQuery } from "@/lib/catalog-filters";
import { productCardSelect, type ProductCardData } from "@/server/catalog/queries";

// Typo tolerance: pg_trgm word similarity. 0.3 matches "naurto" -> "naruto", "jujutsu kaisn" -> "jujutsu kaisen".
const WORD_SIMILARITY = 0.3;

/**
 * Corrects each query word to the closest catalog word by edit distance (handles swapped letters like
 * "naurto", which trigram similarity scores poorly). Returns null when nothing changes.
 */
export async function correctQuery(rawQuery: string): Promise<string | null> {
  const tokens = normalizeQuery(rawQuery).split(" ").filter(Boolean).slice(0, 6);
  if (!tokens.length) return null;
  let changed = false;
  const corrected: string[] = [];
  for (const t of tokens) {
    if (t.length < 4 || /\d/.test(t)) {
      corrected.push(t);
      continue;
    }
    // A swapped letter pair ("naurto") is two edits, so allow 2 for words of 5+ letters.
    const maxDist = t.length >= 5 ? 2 : 1;
    const rows = await db.$queryRaw<{ w: string; d: number }[]>`
      WITH words AS (
        SELECT DISTINCT unnest(string_to_array("searchText", ' ')) AS w FROM "Product" WHERE "status" = 'ACTIVE'
      )
      SELECT w, levenshtein(w, ${t}) AS d FROM words
      WHERE length(w) BETWEEN ${t.length - 2} AND ${t.length + 2} AND levenshtein(w, ${t}) <= ${maxDist}
      ORDER BY d ASC, length(w) ASC LIMIT 1`;
    const best = rows[0];
    if (best && best.w !== t) {
      corrected.push(best.w);
      changed = true;
    } else corrected.push(t);
  }
  return changed ? corrected.join(" ") : null;
}

/** Product IDs ranked by relevance, with automatic typo correction when the literal query finds little. */
export async function searchProductIds(rawQuery: string, limit = 200): Promise<string[]> {
  const ids = await rankedIds(rawQuery, limit);
  if (ids.length >= 5) return ids;
  const fixed = await correctQuery(rawQuery);
  if (!fixed) return ids;
  const more = await rankedIds(fixed, limit);
  return [...new Set([...more, ...ids])].slice(0, limit);
}

/** Prefix/substring matches first, then trigram similarity, then popularity. */
async function rankedIds(rawQuery: string, limit: number): Promise<string[]> {
  const q = normalizeQuery(rawQuery);
  if (q.length < 1) return [];
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const [, rows] = await db.$transaction([
    db.$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(WORD_SIMILARITY)}, true)`,
    db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "Product"
      WHERE "status" = 'ACTIVE' AND ("searchText" LIKE ${like} OR ${q} <% "searchText")
      ORDER BY ("searchText" LIKE ${like}) DESC, word_similarity(${q}, "searchText") DESC, "salesCount" DESC, "ratingAvg" DESC
      LIMIT ${limit}`),
  ]);
  return rows.map((r) => r.id);
}

export type Suggestions = {
  products: ProductCardData[];
  categories: { slug: string; name: string }[];
  anime: { slug: string; name: string }[];
  didYouMean: string | null;
};

export async function getSuggestions(rawQuery: string): Promise<Suggestions> {
  const q = normalizeQuery(rawQuery);
  if (!q) return { products: [], categories: [], anime: [], didYouMean: null };
  const like = `%${q}%`;
  const [ids, categories, anime, corrected] = await Promise.all([
    searchProductIds(q, 6),
    db.$queryRaw<{ slug: string; name: string }[]>`
      SELECT "slug", "name" FROM "Category" WHERE "isActive" AND (lower("name") LIKE ${like} OR word_similarity(${q}, lower("name")) > 0.4)
      ORDER BY word_similarity(${q}, lower("name")) DESC LIMIT 4`,
    db.$queryRaw<{ slug: string; name: string }[]>`
      SELECT "slug", "name" FROM "AnimeFranchise" WHERE lower("name") LIKE ${like} OR word_similarity(${q}, lower("name")) > 0.4
      ORDER BY word_similarity(${q}, lower("name")) DESC LIMIT 4`,
    correctQuery(q),
  ]);
  const products = ids.length
    ? (await db.product.findMany({ where: { id: { in: ids } }, select: productCardSelect })).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
    : [];
  return { products, categories, anime, didYouMean: corrected };
}

export async function trendingSearches(limit = 8): Promise<string[]> {
  const rows = await db.$queryRaw<{ query: string }[]>`
    SELECT "query" FROM "SearchQuery" WHERE "createdAt" > now() - interval '14 days' AND "resultCount" > 0
    GROUP BY "query" ORDER BY count(*) DESC LIMIT ${limit}`;
  if (rows.length >= 4) return rows.map((r) => r.query);
  const fallback = await db.animeFranchise.findMany({ where: { isTrending: true }, orderBy: { position: "asc" }, take: limit, select: { name: true } });
  return [...rows.map((r) => r.query), ...fallback.map((f) => f.name)].slice(0, limit);
}

export async function logSearch(query: string, resultCount: number, userId?: string | null) {
  const q = normalizeQuery(query);
  if (q.length < 2) return;
  await db.searchQuery.create({ data: { query: q, resultCount, userId: userId ?? null } }).catch(() => undefined);
}
