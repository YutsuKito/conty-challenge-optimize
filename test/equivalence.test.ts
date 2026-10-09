import { describe, expect, it } from "vitest";
import { listCreators } from "../src/list-creators.ts";
import { listCreators as original } from "./original-reference.ts";
import { openDatabase, resetQueryCount, getQueryCount } from "../src/db.ts";
import { seed, CAMPAIGN_ID } from "../src/seed.ts";

describe("equivalência com o algoritmo original", () => {
  for (const [creators, randomSeed] of [[80, 17], [600, 31], [2000, 43]]) {
    it(`compara todas as páginas de ${creators} criadores, seed ${randomSeed}`, async () => {
      const db = openDatabase();
      try {
        seed(db, { creators, seed: randomSeed });
        const full = await original(db, { campaignId: CAMPAIGN_ID, limit: creators, offset: 0 });
        for (let offset = 0; offset <= full!.total + 50; offset += 50) {
          resetQueryCount();
          const actual = await listCreators(db, { campaignId: CAMPAIGN_ID, limit: 50, offset });
          expect(actual).toEqual({ ...full, creators: full!.creators.slice(offset, offset + 50) });
          expect(getQueryCount()).toBe(3);
        }
      } finally { db.close(); }
    });
  }

  it("preserva soma acima do limite seguro e a ordem de arredondamento por conta", async () => {
    const db = openDatabase();
    try {
      db.exec(`INSERT INTO campaigns VALUES ('c', 'C', '["a","a"]');
        INSERT INTO creators VALUES ('z', 'Z', '["a","a"]', ''), ('b', 'B', '["a","a"]', ''),
          ('none', 'None', '["a"]', ''), ('excluded', 'Excluded', '["x"]', '');`);
      const account = db.prepare("INSERT INTO social_accounts VALUES (?, ?, 'fake')");
      const metric = db.prepare("INSERT INTO metrics VALUES (?, ?, ?, '2026-05-01', '')");
      for (const [creator, values] of [
        ["z", [9000000000000000, 9000000000000000, 1, 1, 1]],
        ["b", [1, 1, 1, 9000000000000000, 9000000000000000]],
      ] as const) {
        values.forEach((views, index) => {
          const id = `${creator}-${index}`;
          account.run(id, creator); metric.run(id, id, views);
        });
      }
      db.exec(`INSERT INTO social_accounts VALUES ('bad', 'excluded', 'fake');
        INSERT INTO metrics VALUES ('bad', 'bad', 9223372036854775807, '2026-05-01', '');
        INSERT INTO metrics VALUES ('z-new', 'z-0', 9000000000000000, '2026-05-01', '');`);
      const input = { campaignId: "c", limit: 20, offset: 0 };
      const expected = await original(db, input);
      expect(expected!.creators.find(c => c.id === "z")!.latest_reach).toBe(18000000000000000);
      expect(expected!.creators.find(c => c.id === "b")!.latest_reach).toBeGreaterThan(18000000000000000);
      expect(await listCreators(db, input)).toEqual(expected);
    } finally { db.close(); }
  });

  it("compara nichos duplicados, empates, contas vazias, corte inclusivo e página vazia", async () => {
    const db = openDatabase();
    try {
      db.exec(`INSERT INTO campaigns VALUES ('c','C','["a","a"]'), ('empty','Empty','["x"]');
        INSERT INTO creators VALUES ('a','A','["a","a"]',''), ('b','B','["a","a"]',''), ('c','C','["a"]','');
        INSERT INTO social_accounts VALUES ('a','a','fake'), ('b','b','fake'), ('c','c','fake');
        INSERT INTO metrics VALUES ('m0','a',999,'2026-04-01',''), ('m1','a',10,'2026-05-01',''),
          ('m2','a',25,'2026-05-01',''), ('m3','b',25,'2026-05-01','');
        INSERT INTO deliveries VALUES ('d0','a','2026-03-03T11:59:59.999Z'), ('d1','a','2026-03-03T12:00:00.000Z');`);
      for (const campaignId of ["c", "empty", "missing"]) {
        for (const offset of [0, 1, 3, 100]) {
          const input = { campaignId, limit: 1, offset };
          expect(await listCreators(db, input)).toEqual(await original(db, input));
        }
      }
    } finally { db.close(); }
  });
});
