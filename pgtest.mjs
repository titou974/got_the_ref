import pg from 'pg';
const PW = 'DkppKWJON8K%k0';
const candidates = {
  'session pooler 5432 (retry)': `postgresql://postgres.pppinbvqrmpxmcgpcghs:${encodeURIComponent(PW)}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
  'direct db host 5432': `postgresql://postgres:${encodeURIComponent(PW)}@db.pppinbvqrmpxmcgpcghs.supabase.co:5432/postgres`,
};
for (const [name, connectionString] of Object.entries(candidates)) {
  const c = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  const t = Date.now();
  try {
    await c.connect();
    const r = await c.query('select 1 as ok');
    console.log(`OK  ${name} : (${Date.now()-t}ms)`, r.rows[0]);
    await c.end();
  } catch (e) {
    console.log(`ERR ${name} : (${Date.now()-t}ms) code=${e.code || '-'} msg=${e.message}`);
    try { await c.end(); } catch {}
  }
}
