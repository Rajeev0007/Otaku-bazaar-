import { describe, expect, it } from "vitest";
import { activeFilterCount, filtersToSearchParams, normalizeQuery, parseFilters } from "@/lib/catalog-filters";

describe("listing filters <-> URL", () => {
  it("round-trips every filter through the URL", () => {
    const qs = "q=hoodie&category=clothing&anime=naruto,one-piece&size=M,L&color=Black&min=500&max=2000&rating=4&discount=20&instock=1&sale=1&new=1&limited=1&sort=price_asc&page=3&view=list";
    const f = parseFilters(new URLSearchParams(qs));
    expect(f).toMatchObject({ q: "hoodie", categories: ["clothing"], anime: ["naruto", "one-piece"], sizes: ["M", "L"], colors: ["Black"], minPrice: 500, maxPrice: 2000, rating: 4, discount: 20, inStock: true, sale: true, isNew: true, limited: true, sort: "price_asc", page: 3, view: "list" });
    expect(parseFilters(filtersToSearchParams(f))).toEqual(f);
    // 1 category + 2 anime + 2 sizes + 1 colour + price + rating + discount + 4 toggles
    expect(activeFilterCount(f)).toBe(13);
  });

  it("ignores invalid or hostile values", () => {
    const f = parseFilters(new URLSearchParams("sort=DROP TABLE&page=-5&min=abc&rating=99&type=EVIL,BUNDLE&anime=" + "x".repeat(100)));
    expect(f.sort).toBe("featured");
    expect(f.page).toBe(1);
    expect(f.minPrice).toBeUndefined();
    expect(f.rating).toBe(5);
    expect(f.types).toEqual(["BUNDLE"]);
    expect(f.anime).toEqual([]);
  });

  it("drops default values from the URL so links stay clean", () => {
    expect(filtersToSearchParams(parseFilters(new URLSearchParams(""))).toString()).toBe("");
  });

  it("normalises queries like the search index", () => {
    expect(normalizeQuery("  Naruto  HOODIE!! ")).toBe("naruto hoodie");
    expect(normalizeQuery("Pokémon")).toBe("pokemon");
  });
});
