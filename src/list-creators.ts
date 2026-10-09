import type { DatabaseSync } from 'node:sqlite';
import { deliveriesSince } from './clock.ts';
import { all, get } from './db.ts';

export type CreatorMatch = { id: string; name: string; niche_score: number; latest_reach: number; deliveries_90d: number };
export type CreatorPage = { campaign_id: string; total: number; creators: CreatorMatch[] };
type CampaignRow = { niches_json: string };
type PageRow = CreatorMatch & { total: number; id: string | null };

// Uma consulta para obter a campanha; uma para calcular score, alcance, entregas e paginação.
// LEFT JOIN garante que uma página além do fim também informe `total`.
export async function listCreators(db: DatabaseSync, input: {campaignId:string;limit:number;offset:number}):Promise<CreatorPage|null> {
  const campaign=await get<CampaignRow>(db,'SELECT niches_json FROM campaigns WHERE id = ?',input.campaignId);
  if(!campaign) return null;
  const rows=await all<PageRow>(db,`
    WITH scored AS MATERIALIZED (
      SELECT c.id, c.name,
        (SELECT COUNT(*) FROM json_each(?) cn
          JOIN json_each(c.niches_json) cr ON cn.value = cr.value) AS niche_score,
        COALESCE((SELECT SUM(COALESCE((
            SELECT m.views FROM metrics m WHERE m.account_id = a.id
            ORDER BY m.captured_at DESC, m.id DESC LIMIT 1
          ),0)) FROM social_accounts a WHERE a.creator_id = c.id),0) AS latest_reach,
        (SELECT COUNT(*) FROM deliveries d
          WHERE d.creator_id = c.id AND d.delivered_at >= ?) AS deliveries_90d
      FROM creators c
    ),
    matches AS MATERIALIZED (
      SELECT * FROM scored WHERE niche_score > 0
    ),
    totals AS (SELECT COUNT(*) AS total FROM matches),
    page AS (
      SELECT * FROM matches
      ORDER BY niche_score DESC, latest_reach DESC, id ASC LIMIT ? OFFSET ?
    )
    SELECT totals.total, page.id, page.name, page.niche_score,
           page.latest_reach, page.deliveries_90d
    FROM totals LEFT JOIN page ON 1=1
  `,campaign.niches_json,deliveriesSince(),input.limit,input.offset);
  return {
    campaign_id:input.campaignId,
    total:Number(rows[0]?.total??0),
    creators:rows.filter(r=>r.id!==null).map(r=>({
      id:r.id,name:r.name,niche_score:Number(r.niche_score),
      latest_reach:Number(r.latest_reach),deliveries_90d:Number(r.deliveries_90d)
    })) as CreatorMatch[]
  };
}
