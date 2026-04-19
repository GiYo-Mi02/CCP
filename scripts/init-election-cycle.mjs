import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const PLENARY_POSITION_TITLES = [
  'Presiding Officer',
  'Deputy P.O.',
  'Secretary General',
  'Deputy S.G.',
  'Majority Floor Leader',
  'Minority Floor Leader',
];

const COMMITTEE_POSITION_TITLES = [
  'Committee Chairperson',
  'Deputy Chairperson',
  'Committee Secretary',
];

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

async function main() {
  const env = parseEnvFile('.env.local');
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or key in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, name')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .maybeSingle();

  if (sessionError || !session) {
    console.error(sessionError?.message || 'No active session found.');
    process.exit(1);
  }

  let electionId = null;

  const { data: activeElection, error: activeElectionError } = await supabase
    .from('elections')
    .select('id')
    .eq('session_id', session.id)
    .eq('status', 'active')
    .maybeSingle();

  if (activeElectionError) {
    console.error(`Failed checking active election: ${activeElectionError.message}`);
    process.exit(1);
  }

  if (activeElection) {
    electionId = activeElection.id;
  } else {
    const { data: latestElection, error: latestError } = await supabase
      .from('elections')
      .select('id')
      .eq('session_id', session.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.error(`Failed finding existing election: ${latestError.message}`);
      process.exit(1);
    }

    if (latestElection) {
      const { error: activateError } = await supabase
        .from('elections')
        .update({ status: 'active' })
        .eq('id', latestElection.id);

      if (activateError) {
        console.error(`Failed activating existing election: ${activateError.message}`);
        process.exit(1);
      }

      electionId = latestElection.id;
    } else {
      const { data: createdElection, error: createError } = await supabase
        .from('elections')
        .insert({
          session_id: session.id,
          name: `Plenary & Committee Elections ${new Date().toISOString().slice(0, 10)}`,
          status: 'active',
        })
        .select('id')
        .single();

      if (createError || !createdElection) {
        console.error(createError?.message || 'Failed to create election.');
        process.exit(1);
      }

      electionId = createdElection.id;
    }
  }

  const { data: delegates, error: delegatesError } = await supabase
    .from('profiles')
    .select('id, committee')
    .eq('role', 'delegate');

  if (delegatesError) {
    console.error(`Failed reading delegates: ${delegatesError.message}`);
    process.exit(1);
  }

  let delegateRows = delegates || [];

  if (delegateRows.length === 0) {
    const { data: fallbackProfiles, error: fallbackProfilesError } = await supabase
      .from('profiles')
      .select('id, committee');

    if (fallbackProfilesError) {
      console.error(`Failed reading fallback profiles: ${fallbackProfilesError.message}`);
      process.exit(1);
    }

    delegateRows = fallbackProfiles || [];
  }

  const committeeScopes = Array.from(
    new Set(
      delegateRows
        .map((delegate) => delegate.committee?.trim())
        .filter((committee) => Boolean(committee && committee.length > 0))
    )
  );

  const desiredPositions = [
    ...PLENARY_POSITION_TITLES.map((title) => ({ title, scope: 'plenary' })),
    ...(committeeScopes.length > 0
      ? committeeScopes.flatMap((scope) =>
          COMMITTEE_POSITION_TITLES.map((title) => ({ title, scope }))
        )
      : COMMITTEE_POSITION_TITLES.map((title) => ({ title, scope: 'committee' }))),
  ];

  const { data: existingPositions, error: existingPositionsError } = await supabase
    .from('election_positions')
    .select('id, title, scope')
    .eq('election_id', electionId);

  if (existingPositionsError) {
    console.error(`Failed reading election positions: ${existingPositionsError.message}`);
    process.exit(1);
  }

  const existingKeys = new Set((existingPositions || []).map((p) => `${p.title}::${p.scope}`));
  const missingPositions = desiredPositions.filter((position) => !existingKeys.has(`${position.title}::${position.scope}`));

  if (missingPositions.length > 0) {
    const { error: insertPositionsError } = await supabase.from('election_positions').insert(
      missingPositions.map((position) => ({
        election_id: electionId,
        title: position.title,
        scope: position.scope,
      }))
    );

    if (insertPositionsError) {
      console.error(`Failed inserting election positions: ${insertPositionsError.message}`);
      process.exit(1);
    }
  }

  const { data: allPositions, error: allPositionsError } = await supabase
    .from('election_positions')
    .select('id, scope')
    .eq('election_id', electionId);

  if (allPositionsError) {
    console.error(`Failed reading all positions: ${allPositionsError.message}`);
    process.exit(1);
  }

  const candidateRows = [];

  for (const position of allPositions || []) {
    let pool =
      position.scope === 'plenary'
        ? delegateRows
        : delegateRows.filter((delegate) => delegate.committee === position.scope);

    if (pool.length === 0) {
      pool = delegateRows;
    }

    for (const delegate of pool) {
      candidateRows.push({ profile_id: delegate.id, position_id: position.id });
    }
  }

  if (candidateRows.length > 0) {
    const { error: candidatesError } = await supabase
      .from('candidates')
      .upsert(candidateRows, { onConflict: 'profile_id,position_id' });

    if (candidatesError) {
      console.error(`Failed upserting candidates: ${candidatesError.message}`);
      process.exit(1);
    }
  }

  console.log(`Election cycle ready for session: ${session.name}`);
  console.log(`Election ID: ${electionId}`);
  console.log(`Positions: ${(allPositions || []).length}`);
  console.log(`Delegates loaded as candidates: ${delegateRows.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
