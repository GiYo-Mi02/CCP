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

const FINAL_VOTATION_DEMO_MOTIONS = [
  {
    article_ref: 'Article II',
    section_ref: 'Section 1',
    original_text:
      'The plenary committee shall convene on demand as prescribed by the presiding officer.',
    proposed_text:
      'The plenary committee shall convene on a fixed bi-weekly calendar unless emergency session is approved by majority vote.',
    justification:
      'Regular cadence improves preparation and reduces procedural confusion during critical votes.',
  },
  {
    article_ref: 'Article IV',
    section_ref: 'Section 3',
    original_text:
      'Delegates may submit motions in writing before the close of deliberation.',
    proposed_text:
      'Delegates may submit motions in writing and through the secured digital docket before deliberation closes.',
    justification:
      'Digital submission keeps records auditable and prevents lost paper submissions in high-volume sessions.',
  },
  {
    article_ref: 'Article VI',
    section_ref: 'Section 2',
    original_text:
      'Committee reports shall be presented at the discretion of the chair.',
    proposed_text:
      'Committee reports shall be presented at the opening of each plenary day with a five-minute summary cap.',
    justification:
      'Standardized reporting reduces agenda drift and ensures all committees are heard fairly.',
  },
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

  const { data: finalVotationPeriod, error: finalPeriodError } = await supabase
    .from('periods')
    .select('id')
    .eq('session_id', sessionId)
    .eq('period_type', 'final_votation')
    .maybeSingle();

  if (finalPeriodError) {
    console.error(`Failed loading final votation period: ${finalPeriodError.message}`);
    process.exit(1);
  }

  if (!finalVotationPeriod) {
    console.log('Final votation period not found, skipping demo motion seeding.');
    return;
  }

  const { count: finalMotionCount, error: finalMotionCountError } = await supabase
    .from('motions')
    .select('id', { count: 'exact', head: true })
    .eq('period_id', finalVotationPeriod.id);

  if (finalMotionCountError) {
    console.error(`Failed checking final motions: ${finalMotionCountError.message}`);
    process.exit(1);
  }

  if ((finalMotionCount ?? 0) > 0) {
    console.log(`Final votation already has ${finalMotionCount} motion(s). Demo seed skipped.`);
    return;
  }

  const { data: delegates, error: delegatesError } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'delegate')
    .order('created_at', { ascending: true });

  if (delegatesError) {
    console.error(`Failed loading delegates for demo seed: ${delegatesError.message}`);
    process.exit(1);
  }

  let authorPool = delegates ?? [];

  if (authorPool.length === 0) {
    const { data: fallbackProfiles, error: fallbackProfilesError } = await supabase
      .from('profiles')
      .select('id')
      .order('created_at', { ascending: true });

    if (fallbackProfilesError) {
      console.error(`Failed loading fallback profiles for demo seed: ${fallbackProfilesError.message}`);
      process.exit(1);
    }

    authorPool = fallbackProfiles ?? [];
  }

  if (authorPool.length === 0) {
    console.log('No profiles found. Skipping final votation demo motion seeding.');
    return;
  }

  const seedRows = FINAL_VOTATION_DEMO_MOTIONS.map((motion, index) => ({
    period_id: finalVotationPeriod.id,
    author_id: authorPool[index % authorPool.length].id,
    motion_type: 'quick_motion',
    article_ref: motion.article_ref,
    section_ref: motion.section_ref,
    original_text: motion.original_text,
    proposed_text: motion.proposed_text,
    justification: motion.justification,
    status: 'pending',
  }));

  const { error: seedError } = await supabase.from('motions').insert(seedRows);

  if (seedError) {
    console.error(`Failed seeding final votation demo motions: ${seedError.message}`);
    process.exit(1);
  }

  console.log(`Seeded ${seedRows.length} demo motion(s) for final votation.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
