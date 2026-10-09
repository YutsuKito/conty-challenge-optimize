import type { DatabaseSync } from "node:sqlite";
import { deliveriesSince } from "./clock.ts";
import { all, get } from "./db.ts";

export type CreatorMatch = { id: string; name: string; niche_score: number; latest_reach: number; deliveries_90d: number };
export type CreatorPage = { campaign_id: string; total: number; creators: CreatorMatch[] };
type CampaignRow = { niches_json: string };
type AccountMetric = { creator_id: string; views: number | null };

// Three fixed reads. Sum in account insertion order, as in the original JavaScript:
// SQLite integer SUM can overflow or exceed the driver's safe integer range.
export async function listCreators(
  db: DatabaseSync, input: { campaignId: string; limit: number; offset: number },
): Promise<CreatorPage | null> {
  const campaign = await get<CampaignRow>(db, "SELECT niches_json FROM campaigns WHERE id = ?", input.campaignId);
  if (!campaign) return null;
  const scores = `(SELECT COUNT(*) FROM json_each(?) cn
    JOIN json_each(c.niches_json) cr ON cn.value = cr.value)`;
  const creators = await all<CreatorMatch>(db, `
    SELECT c.id, c.name, ${scores} AS niche_score, 0 AS latest_reach,
      (SELECT COUNT(*) FROM deliveries d
        WHERE d.creator_id = c.id AND d.delivered_at >= ?) AS deliveries_90d
    FROM creators c WHERE ${scores} > 0
  `, campaign.niches_json, deliveriesSince(), campaign.niches_json);
  const metrics = await all<AccountMetric>(db, `
    SELECT a.creator_id, (
      SELECT m.views FROM metrics m WHERE m.account_id = a.id
      ORDER BY m.captured_at DESC, m.id DESC LIMIT 1
    ) AS views
    FROM social_accounts a JOIN creators c ON c.id = a.creator_id
    WHERE ${scores} > 0
    ORDER BY a.rowid ASC
  `, campaign.niches_json);
  const byId = new Map(creators.map(creator => [creator.id, creator]));
  for (const metric of metrics) {
    if (metric.views !== null) byId.get(metric.creator_id)!.latest_reach += metric.views;
  }
  creators.sort((left, right) => {
    if (right.niche_score !== left.niche_score) return right.niche_score - left.niche_score;
    if (right.latest_reach !== left.latest_reach) return right.latest_reach - left.latest_reach;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
  return {
    campaign_id: input.campaignId, total: creators.length,
    creators: creators.slice(input.offset, input.offset + input.limit),
  };
}
