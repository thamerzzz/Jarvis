// Seed graph built from the 2026-10-09 CRM / ICP / 3-year-plan export.
// Node ids prefixed by kind. `match` lists lowercase substrings of MCP tool names
// (mcp__<Server>__<tool>) that should light the node up when Claude uses them.

const streams = [
  { id: 'stream:onprem', name: 'On-prem deals', y: [2, 4, 7], unit: 'deals' },
  { id: 'stream:cloud', name: 'Cloud companies', y: [15, 50, 120], unit: 'companies' },
  { id: 'stream:market', name: 'Market orders', y: [30, 80, 180], unit: 'orders' },
  { id: 'stream:studio', name: 'Studio startups', y: [10, 25, 45], unit: 'startups' },
];

// [id, name, tag, crmSegmentId, stream, focusRank]
const segments = [
  ['nadwoor-contract', 'Nadwoor Contract', 'nadwoorcontract', 3, 'stream:onprem', 1],
  ['ohjiya-market', 'Ohjiya Market', 'ohjiyamarket', 1, 'stream:market', 2],
  ['reayat', 'Reayat', 'reayat', 5, null, 3],
  ['ohjiya-mega', 'Ohjiya Mega Project', 'ohjiyamegaproject', 11, null, 4],
  ['taswooq', 'Taswooq Vendor', 'taswooqvendor', 6, null, 5],
  ['hattly', 'Hattly Vendor', 'hattlyvendor', 7, null, 5],
  ['albayt', 'Albayt Carpet Vendor', 'albaytcarpetvendor', 8, null, 5],
  ['jobber', 'Jobber Vendor', 'jobbervendor', 9, null, 5],
  ['nadwoor-cloud', 'Nadwoor Cloud SaaS', 'nadwoorcloudsaas', 4, 'stream:cloud', 6],
  ['moosanid', 'Moosanid Services', 'moosanidservices', 10, null, 7],
  ['startup-studio', 'Startup Studio', 'startupstudio', 2, 'stream:studio', 8],
];

const tools = [
  ['crm', 'Jetpack CRM (crm.gulfcesar.com)', ['gulfcesar', 'crm']],
  ['make', 'Make', ['make']],
  ['hubspot', 'HubSpot', ['hubspot']],
  ['notion', 'Notion', ['notion']],
  ['gdrive', 'Google Drive / Sheets', ['google_drive']],
  ['gmail', 'Gmail', ['gmail']],
  ['gcal', 'Google Calendar', ['google_calendar']],
  ['airtable', 'Airtable', ['airtable']],
  ['tinyfish', 'TinyFish', ['tinyfish']],
  ['apify', 'Apify', ['apify']],
  ['metricool', 'Metricool', ['metricool']],
  ['canva', 'Canva', ['canva']],
  ['novamira', 'Novamira (WordPress sites)', ['novamira', 'novimira']],
  ['ohjiya-sa', 'ohjiya.sa (Hub + publisher)', ['ohjiya']],
];

const docs = [
  ['icp-plan', 'ICP & 3-year plan doc'],
  ['lead-sheet', 'Pilot leads sheet v2'],
  ['lead-queue', 'Lead Queue plugin v0.2.1'],
  ['mufeed', 'Mufeed contract (Reayat)'],
];

const leads = [
  ['Al Muhaidib Group', 'named', 'nadwoor-contract'],
  ['Dallah Health', 'named', 'nadwoor-contract'],
  ['Almana Hospital Group', 'needs-name', 'nadwoor-contract'],
  ['Saudi Marafiq', 'needs-name', 'nadwoor-contract'],
  ['Safari Group', 'needs-name', 'nadwoor-contract'],
];

const tasks = [
  ['t1', 'Remove sandbox plugin copy, test Lead Queue page', 'lead-queue'],
  ['t2', 'Import 1 lead, Approve, verify company+tag+note', 'lead-queue'],
  ['t3', '2nd search round: Almana, Marafiq, Safari', 'nadwoor-contract'],
  ['t4', 'Approve outreach wording, pick send route', 'nadwoor-contract'],
  ['t5', 'Review Reayat events, seats, prices (Family Nights SAR 1?)', 'reayat'],
  ['t6', 'Build Make scenarios: find+clean, draft+follow-up', 'make'],
  ['t7', 'Ohjiya Market automation: channels, schedule, replies', 'ohjiya-market'],
];

export function buildGraph() {
  const nodes = [];
  const links = [];
  const n = (o) => nodes.push(o);
  const l = (s, t) => links.push({ source: s, target: t });

  n({ id: 'core', kind: 'core', name: 'Ohjiya', val: 14 });
  n({ id: 'plan', kind: 'doc', name: '3-Year Plan', val: 9 });
  l('core', 'plan');

  for (const s of streams) {
    n({ id: s.id, kind: 'stream', name: s.name, val: 7, target: s.y, unit: s.unit, actual: null });
    l('plan', s.id);
  }
  for (const [id, name, tag, segId, stream, rank] of segments) {
    n({ id: `seg:${id}`, kind: 'segment', name, val: 6, tag, crmSegmentId: segId, focusRank: rank });
    l(stream || 'plan', `seg:${id}`);
  }
  for (const [id, name, match] of tools) {
    n({ id: `tool:${id}`, kind: 'tool', name, val: 5, match, status: 'unknown' });
    l('core', `tool:${id}`);
  }
  l('seg:ohjiya-market', 'tool:ohjiya-sa');
  l('seg:nadwoor-contract', 'tool:crm');
  for (const [id, name] of docs) {
    n({ id: `doc:${id}`, kind: 'doc', name, val: 4 });
  }
  l('plan', 'doc:icp-plan');
  l('doc:lead-sheet', 'seg:nadwoor-contract');
  l('doc:lead-queue', 'tool:crm');
  l('doc:mufeed', 'seg:reayat');
  for (const [name, status, seg] of leads) {
    n({ id: `lead:${name}`, kind: 'lead', name, val: 3, status });
    l(`seg:${seg}`, `lead:${name}`);
  }
  for (const [id, name, ref] of tasks) {
    n({ id: `task:${id}`, kind: 'task', name, val: 3 });
    const target = ref.startsWith('lead-queue') ? 'doc:lead-queue' : tools.some((t) => t[0] === ref) ? `tool:${ref}` : `seg:${ref}`;
    l(`task:${id}`, target);
  }
  return { nodes, links };
}
