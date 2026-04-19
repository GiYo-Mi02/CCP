import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function parseEnvFile(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const env = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const REQUIRED_PERIODS = [
  { period_type: 'election', sort_order: 1 },
  { period_type: 'quash', sort_order: 2 },
  { period_type: 'amendment', sort_order: 3 },
  { period_type: 'insertion', sort_order: 4 },
  { period_type: 'quick_motion', sort_order: 5 },
  { period_type: 'final_votation', sort_order: 6 },
];

async function main() {
  const env = parseEnvFile('.env.local');
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or key in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: activeSession, error: activeSessionError } = await supabase
    .from('sessions')
    .select('id, name')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .maybeSingle();

  if (activeSessionError) {
    console.error(`Failed reading sessions: ${activeSessionError.message}`);
    process.exit(1);
  }

  let sessionId = activeSession?.id || null;

  if (!sessionId) {
    const name = `Convention Session ${new Date().toISOString().slice(0, 10)}`;
    const { data: created, error: createError } = await supabase
      .from('sessions')
      .insert({ name, status: 'active' })
      .select('id, name')
      .single();

    if (createError || !created) {
      console.error(`Failed creating active session: ${createError?.message || 'Unknown error'}`);
      process.exit(1);
    }

    sessionId = created.id;
    console.log(`Created active session: ${created.name}`);
  } else {
    console.log(`Using existing active session: ${activeSession?.name || sessionId}`);
  }

  const { data: existingPeriods, error: existingError } = await supabase
    .from('periods')
    .select('period_type')
    .eq('session_id', sessionId);

  if (existingError) {
    console.error(`Failed reading periods: ${existingError.message}`);
    process.exit(1);
  }

  const existingTypes = new Set((existingPeriods || []).map((p) => p.period_type));

  const missing = REQUIRED_PERIODS.filter((period) => !existingTypes.has(period.period_type));

  if (missing.length > 0) {
    const { error: insertError } = await supabase.from('periods').insert(
      missing.map((period) => ({
        session_id: sessionId,
        period_type: period.period_type,
        state: 'pending',
        deadline: null,
        sort_order: period.sort_order,
      }))
    );

    if (insertError) {
      console.error(`Failed inserting periods: ${insertError.message}`);
      process.exit(1);
    }

    console.log(`Inserted ${missing.length} missing periods.`);
  } else {
    console.log('All required periods are already present.');
  }

  const { data: finalPeriods, error: finalError } = await supabase
    .from('periods')
    .select('period_type, state, sort_order')
    .eq('session_id', sessionId)
    .order('sort_order', { ascending: true });

  if (finalError) {
    console.error(`Failed to confirm periods: ${finalError.message}`);
    process.exit(1);
  }

  console.log('Final periods configured:');
  for (const period of finalPeriods || []) {
    console.log(`- ${period.sort_order}: ${period.period_type} (${period.state})`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
