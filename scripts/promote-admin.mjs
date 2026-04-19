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

async function main() {
  const env = parseEnvFile('.env.local');
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or key in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const emailArgIndex = process.argv.findIndex((arg) => arg === '--email');
  const providedEmail = emailArgIndex >= 0 ? process.argv[emailArgIndex + 1] : undefined;

  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (listError) {
    console.error(`Failed to list users: ${listError.message}`);
    process.exit(1);
  }

  const users = listData?.users ?? [];
  if (users.length === 0) {
    console.error('No auth users found. Sign up first, then rerun this script.');
    process.exit(1);
  }

  let targetUser = null;

  if (providedEmail) {
    targetUser = users.find((u) => (u.email || '').toLowerCase() === providedEmail.toLowerCase()) || null;
    if (!targetUser) {
      console.error(`No user found for email: ${providedEmail}`);
      console.error('Available users:');
      for (const user of users) {
        console.error(`- ${user.email || '(no email)'} (${user.id})`);
      }
      process.exit(1);
    }
  } else if (users.length === 1) {
    targetUser = users[0];
  } else {
    console.error('Multiple users found. Rerun with: node scripts/promote-admin.mjs --email your@email.com');
    console.error('Available users:');
    for (const user of users) {
      console.error(`- ${user.email || '(no email)'} (${user.id})`);
    }
    process.exit(1);
  }

  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert({ id: targetUser.id, role: 'admin', updated_at: new Date().toISOString() }, { onConflict: 'id' });

  if (upsertError) {
    console.error(`Failed to grant admin role: ${upsertError.message}`);
    process.exit(1);
  }

  console.log(`Admin role granted to ${targetUser.email || targetUser.id}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
