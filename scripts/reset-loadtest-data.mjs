import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const LOADTEST_EMAIL_PATTERN = /^loadtest\.delegate\+\d{3}@ccp\.local$/i;

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

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function listAllUsers(adminClient) {
  const all = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed listing users: ${error.message}`);

    const users = data?.users ?? [];
    all.push(...users);

    if (users.length < perPage) break;
    page += 1;
  }

  return all;
}

async function countTableRows(client, table, column = 'id') {
  const { count, error } = await client
    .from(table)
    .select(column, { count: 'exact', head: true });

  if (error) throw new Error(`Failed counting ${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const env = parseEnvFile('.env.local');

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'Missing Supabase credentials. Need NEXT_PUBLIC_SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).'
    );
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const usersBefore = await listAllUsers(adminClient);
  const targetUsers = usersBefore.filter((user) => {
    const email = user.email || '';
    return LOADTEST_EMAIL_PATTERN.test(email);
  });

  const targetIds = targetUsers.map((user) => user.id);

  console.log(`Found ${targetUsers.length} loadtest auth user(s).`);

  const motionsBefore = await countTableRows(adminClient, 'motions');
  const votesBefore = await countTableRows(adminClient, 'votes');
  const electionVotesBefore = await countTableRows(adminClient, 'election_votes');
  const candidatesBefore = await countTableRows(adminClient, 'candidates');

  // Remove loadtest-generated motions by marker fields.
  const markerDeletes = [
    adminClient.from('motions').delete().like('article_ref', 'LT-%'),
    adminClient.from('motions').delete().like('section_ref', 'LT-%'),
    adminClient.from('motions').delete().ilike('justification', '%Phase 2%'),
    adminClient.from('motions').delete().ilike('justification', '%Load test%'),
  ];

  for (const deletion of markerDeletes) {
    const { error } = await deletion;
    if (error) {
      throw new Error(`Failed deleting marker motions: ${error.message}`);
    }
  }

  // Remove remaining loadtest user-linked rows in chunks before auth user deletion.
  for (const ids of chunk(targetIds, 100)) {
    if (ids.length === 0) continue;

    const { error: votesError } = await adminClient
      .from('votes')
      .delete()
      .in('voter_id', ids);

    if (votesError) throw new Error(`Failed deleting votes for loadtest users: ${votesError.message}`);

    const { error: electionVotesError } = await adminClient
      .from('election_votes')
      .delete()
      .in('voter_id', ids);

    if (electionVotesError) {
      throw new Error(`Failed deleting election votes for loadtest users: ${electionVotesError.message}`);
    }

    const { error: candidatesError } = await adminClient
      .from('candidates')
      .delete()
      .in('profile_id', ids);

    if (candidatesError) {
      throw new Error(`Failed deleting candidate rows for loadtest users: ${candidatesError.message}`);
    }

    const { error: motionsError } = await adminClient
      .from('motions')
      .delete()
      .in('author_id', ids);

    if (motionsError) {
      throw new Error(`Failed deleting motions for loadtest users: ${motionsError.message}`);
    }
  }

  // Delete auth users (profiles + dependent rows cascade from auth.users -> profiles).
  for (const user of targetUsers) {
    const { error } = await adminClient.auth.admin.deleteUser(user.id);
    if (error) {
      throw new Error(`Failed deleting auth user ${user.email}: ${error.message}`);
    }
  }

  // Final cleanup for any stray profiles left by manual edits.
  const { error: strayProfilesError } = await adminClient
    .from('profiles')
    .delete()
    .like('full_name', 'LoadTest Delegate %');

  if (strayProfilesError) {
    throw new Error(`Failed deleting stray loadtest profiles: ${strayProfilesError.message}`);
  }

  const usersAfter = await listAllUsers(adminClient);
  const loadtestUsersAfter = usersAfter.filter((user) => LOADTEST_EMAIL_PATTERN.test(user.email || ''));

  const motionsAfter = await countTableRows(adminClient, 'motions');
  const votesAfter = await countTableRows(adminClient, 'votes');
  const electionVotesAfter = await countTableRows(adminClient, 'election_votes');
  const candidatesAfter = await countTableRows(adminClient, 'candidates');

  console.log('Cleanup complete.');
  console.log(`Loadtest auth users remaining: ${loadtestUsersAfter.length}`);
  console.log(`motions: ${motionsBefore} -> ${motionsAfter}`);
  console.log(`votes: ${votesBefore} -> ${votesAfter}`);
  console.log(`election_votes: ${electionVotesBefore} -> ${electionVotesAfter}`);
  console.log(`candidates: ${candidatesBefore} -> ${candidatesAfter}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
