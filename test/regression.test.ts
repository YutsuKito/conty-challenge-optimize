import { describe, expect, it } from "vitest";
import { listCreators } from "../src/list-creators.ts";
import { getQueryCount, openDatabase, resetQueryCount } from "../src/db.ts";
import { CAMPAIGN_ID, seed } from "../src/seed.ts";

describe("custo constante da listagem", () => {
  for (const creators of [80, 600, 2000]) {
    it(`${creators} criadores usam duas chamadas SQL`, async () => {
      const db = openDatabase();
      seed(db, { creators, seed: 7 });
      resetQueryCount();
      const page = await listCreators(db, { campaignId: CAMPAIGN_ID, limit: 20, offset: 0 });
      expect(page?.creators.length).toBeLessThanOrEqual(20);
      expect(getQueryCount()).toBe(2);
      db.close();
    });
  }
  it("conta nichos duplicados como a implementação original", async () => {
    const db = openDatabase();
    db.exec(`
      INSERT INTO campaigns VALUES ('campaign', 'C', '["beauty","beauty"]');
      INSERT INTO creators VALUES ('creator', 'A', '["beauty","beauty"]', '');
    `);
    const page = await listCreators(db, { campaignId: "campaign", limit: 20, offset: 0 });
    expect(page?.creators[0]?.niche_score).toBe(4);
    db.close();
  });
});
