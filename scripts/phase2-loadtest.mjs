import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createClient } from '@supabase/supabase-js';

const TOTAL_DELEGATES = Number(process.env.LOADTEST_DELEGATES || 65);
const TEST_PASSWORD = process.env.LOADTEST_PASSWORD || 'LoadTest#2026!';
const USERS_FILE = process.env.LOADTEST_USERS_FILE || '';
const ROUTE_ROUNDS = Number(process.env.LOADTEST_ROUTE_ROUNDS || 3);
const REALTIME_SUBSCRIBERS = Number(process.env.LOADTEST_REALTIME_SUBSCRIBERS || 10);
const REALTIME_TIMEOUT_MS = Number(process.env.LOADTEST_REALTIME_TIMEOUT_MS || 8000);
const COMMITTEES = [
  'Committee on Bill of Rights',
  'Committee on Executive',
  'Committee on Legislative',
  'Committee on Judiciary',
  'Committee on Local Government',
  'Committee on Finance',
];

const THRESHOLDS = {
  route: {
    minSuccessRate: 0.95,
    maxP95Ms: 700,
  },
  writes: {
    minSuccessRate: 0.9,
    maxP95Ms: 900,
  },
  realtime: {
    minSubscriberCoverage: 0.8,
  },
};

function parseEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const env = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  const code = String(error?.code || error?.cause?.code || '').toUpperCase();

  return (
    message.includes('fetch failed') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('network') ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN'
  );
}

async function withRetry(fn, options = {}) {
  const maxAttempts = options.maxAttempts ?? 5;
  const baseDelayMs = options.baseDelayMs ?? 250;

  let attempt = 0;
  let lastError;

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (!isTransientError(error) || attempt >= maxAttempts) {
        throw error;
      }

      await sleep(baseDelayMs * attempt);
    }
  }

  throw lastError;
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function formatMs(value) {
  return `${value.toFixed(2)}ms`;
}

async function listAllAuthUsers(adminClient) {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await withRetry(() =>
      adminClient.auth.admin.listUsers({
        page,
        perPage,
      })
    );

    if (error) {
      throw new Error(`Failed listing auth users: ${error.message}`);
    }

    users.push(...(data?.users || []));
    if (!data?.users || data.users.length < perPage) break;
    page += 1;
  }

  return users;
}

function buildDelegateIdentity(index) {
  const number = String(index + 1).padStart(3, '0');
  return {
    email: `loadtest.delegate+${number}@ccp.local`,
    fullName: `LoadTest Delegate ${number}`,
    college: `College ${String((index % 12) + 1).padStart(2, '0')}`,
    committee: COMMITTEES[index % COMMITTEES.length],
  };
}

async function ensureDelegates(adminClient) {
  const existingUsers = await listAllAuthUsers(adminClient);
  const emailMap = new Map(existingUsers.map((user) => [user.email?.toLowerCase(), user]));

  const ensured = [];
  let created = 0;

  for (let i = 0; i < TOTAL_DELEGATES; i += 1) {
    const identity = buildDelegateIdentity(i);
    const match = emailMap.get(identity.email.toLowerCase());

    let userId = match?.id;

    if (!userId) {
      const { data, error } = await withRetry(() =>
        adminClient.auth.admin.createUser({
          email: identity.email,
          password: TEST_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: identity.fullName,
          },
        })
      );

      if (error || !data.user) {
        throw new Error(`Failed creating user ${identity.email}: ${error?.message || 'unknown error'}`);
      }

      userId = data.user.id;
      created += 1;
    } else {
      const { error: updatePasswordError } = await withRetry(() =>
        adminClient.auth.admin.updateUserById(userId, {
          password: TEST_PASSWORD,
          user_metadata: {
            full_name: identity.fullName,
          },
        })
      );

      if (updatePasswordError) {
        throw new Error(`Failed updating user ${identity.email}: ${updatePasswordError.message}`);
      }
    }

    const { error: profileError } = await withRetry(() =>
      adminClient.from('profiles').upsert(
        {
          id: userId,
          full_name: identity.fullName,
          college: identity.college,
          committee: identity.committee,
          role: 'delegate',
        },
        { onConflict: 'id' }
      )
    );

    if (profileError) {
      throw new Error(`Failed upserting profile for ${identity.email}: ${profileError.message}`);
    }

    ensured.push({
      id: userId,
      email: identity.email,
      fullName: identity.fullName,
      college: identity.college,
      committee: identity.committee,
    });
  }

  return { delegates: ensured, created };
}

function createInMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

async function authenticateDelegates(env, delegates) {
  const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  const cookieName = `sb-${projectRef}-auth-token`;

  const authResults = [];

  for (const delegate of delegates) {
    let attempt = 0;
    let completed = false;

    while (!completed) {
      attempt += 1;
      const storage = createInMemoryStorage();
      const userClient = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storage,
          },
        }
      );

      const started = performance.now();
      const { error } = await userClient.auth.signInWithPassword({
        email: delegate.email,
        password: TEST_PASSWORD,
      });
      const elapsedMs = performance.now() - started;

      if (error) {
        const rateLimited = /rate limit/i.test(error.message);
        if (rateLimited && attempt < 6) {
          await sleep(400 * attempt);
          continue;
        }

        authResults.push({
          delegate,
          ok: false,
          elapsedMs,
          reason: error.message,
        });
        completed = true;
        break;
      }

      const sessionCookieRaw = storage.getItem(cookieName);
      if (!sessionCookieRaw) {
        authResults.push({
          delegate,
          ok: false,
          elapsedMs,
          reason: `No auth cookie persisted under key ${cookieName}`,
        });
        completed = true;
        break;
      }

      authResults.push({
        delegate,
        ok: true,
        elapsedMs,
        userClient,
        cookieHeader: `${cookieName}=${encodeURIComponent(sessionCookieRaw)}`,
      });
      completed = true;
      await sleep(120);
    }
  }

  const successes = authResults.filter((result) => result.ok);
  const failures = authResults.filter((result) => !result.ok);

  return {
    authenticated: successes,
    failures,
    cookieName,
    authLatencyMs: authResults.map((result) => result.elapsedMs),
  };
}

function loadDelegatesFromUsersFile(filePath) {
  if (!filePath) return [];

  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`LOADTEST_USERS_FILE not found: ${absolute}`);
  }

  const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error('LOADTEST_USERS_FILE must be a JSON array.');
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object' || !item.email || !item.password) {
      throw new Error(
        `Invalid entry at index ${index} in LOADTEST_USERS_FILE. Each item needs email and password.`
      );
    }

    return {
      id: item.id || `external-${index + 1}`,
      email: String(item.email),
      fullName: String(item.fullName || `External Delegate ${index + 1}`),
      college: String(item.college || 'Unknown College'),
      committee: String(item.committee || 'Unknown Committee'),
      password: String(item.password),
    };
  });
}

async function authenticateDelegatesWithIndividualPasswords(env, delegates) {
  const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  const cookieName = `sb-${projectRef}-auth-token`;

  const authResults = [];

  for (const delegate of delegates) {
    let attempt = 0;
    let completed = false;

    while (!completed) {
      attempt += 1;
      const storage = createInMemoryStorage();
      const userClient = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storage,
          },
        }
      );

      const started = performance.now();
      const { error } = await userClient.auth.signInWithPassword({
        email: delegate.email,
        password: delegate.password,
      });
      const elapsedMs = performance.now() - started;

      if (error) {
        const rateLimited = /rate limit/i.test(error.message);
        if (rateLimited && attempt < 6) {
          await sleep(400 * attempt);
          continue;
        }

        authResults.push({
          delegate,
          ok: false,
          elapsedMs,
          reason: error.message,
        });
        completed = true;
        break;
      }

      const sessionCookieRaw = storage.getItem(cookieName);
      if (!sessionCookieRaw) {
        authResults.push({
          delegate,
          ok: false,
          elapsedMs,
          reason: `No auth cookie persisted under key ${cookieName}`,
        });
        completed = true;
        break;
      }

      authResults.push({
        delegate,
        ok: true,
        elapsedMs,
        userClient,
        cookieHeader: `${cookieName}=${encodeURIComponent(sessionCookieRaw)}`,
      });
      completed = true;
      await sleep(120);
    }
  }

  const successes = authResults.filter((result) => result.ok);
  const failures = authResults.filter((result) => !result.ok);

  return {
    authenticated: successes,
    failures,
    cookieName,
    authLatencyMs: authResults.map((result) => result.elapsedMs),
  };
}

async function runRouteSimulation(baseUrl, users, route) {
  const samples = [];
  const statuses = [];

  for (let round = 0; round < ROUTE_ROUNDS; round += 1) {
    const roundResults = await Promise.all(
      users.map(async (user) => {
        const started = performance.now();

        try {
          const response = await fetch(`${baseUrl}${route}`, {
            method: 'GET',
            headers: {
              cookie: user.cookieHeader,
            },
            redirect: 'manual',
          });

          const elapsedMs = performance.now() - started;
          return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            elapsedMs,
          };
        } catch (error) {
          const elapsedMs = performance.now() - started;
          return {
            ok: false,
            status: 0,
            elapsedMs,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );

    for (const result of roundResults) {
      samples.push(result.elapsedMs);
      statuses.push(result.status);
    }
  }

  const total = statuses.length;
  const success = statuses.filter((status) => status >= 200 && status < 300).length;
  const successRate = total > 0 ? success / total : 0;

  return {
    route,
    total,
    success,
    successRate,
    p50Ms: percentile(samples, 50),
    p95Ms: percentile(samples, 95),
    p99Ms: percentile(samples, 99),
    maxMs: samples.length > 0 ? Math.max(...samples) : 0,
    statuses,
  };
}

async function fetchActiveTopology(adminClient) {
  const { data: session, error: sessionError } = await adminClient
    .from('sessions')
    .select('id, name, status')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .maybeSingle();

  if (sessionError) {
    throw new Error(`Failed loading active session: ${sessionError.message}`);
  }

  if (!session) {
    throw new Error('No active session found. Start an active session before Phase 2 test.');
  }

  const { data: periods, error: periodsError } = await adminClient
    .from('periods')
    .select('id, period_type, state, sort_order')
    .eq('session_id', session.id)
    .order('sort_order', { ascending: true });

  if (periodsError) {
    throw new Error(`Failed loading periods: ${periodsError.message}`);
  }

  return {
    session,
    periods: periods || [],
  };
}

function resolveSubmissionPeriod(periods) {
  const preferred = ['quash', 'amendment', 'insertion', 'quick_motion', 'final_votation'];
  return periods.find((period) => period.state === 'active' && preferred.includes(period.period_type)) || null;
}

function resolveVotingPeriod(periods) {
  const preferred = ['quash', 'amendment', 'insertion', 'quick_motion', 'final_votation'];
  return periods.find((period) => period.state === 'votation' && preferred.includes(period.period_type)) || null;
}

function motionTypeForPeriod(periodType) {
  if (periodType === 'quash') return 'quash';
  if (periodType === 'amendment') return 'amendment';
  if (periodType === 'insertion') return 'insertion';
  return 'quick_motion';
}

async function runConcurrentWrites({ adminClient, users, submissionPeriod, votingPeriod }) {
  const writerCount = Math.min(users.length, TOTAL_DELEGATES);
  const submissionWriters = users.slice(0, Math.max(10, Math.floor(writerCount * 0.55)));
  const voteWriters = users.slice(0, writerCount);
  const submissionLatencies = [];
  const voteLatencies = [];
  const submissionStatuses = [];
  const voteStatuses = [];

  let createdMotionIds = [];

  if (submissionPeriod) {
    const type = motionTypeForPeriod(submissionPeriod.period_type);

    const submissionResults = await Promise.all(
      submissionWriters.map(async (user, index) => {
        const started = performance.now();

        const payload = {
          period_id: submissionPeriod.id,
          author_id: user.delegate.id,
          motion_type: type,
          article_ref: `LT-ART-${String(index + 1).padStart(3, '0')}`,
          section_ref: `LT-SEC-${String(index + 1).padStart(3, '0')}`,
          original_text: type === 'insertion' ? null : `Load test original text ${index + 1}`,
          proposed_text: type === 'quash' ? null : `Load test proposed text ${index + 1}`,
          justification: `Phase 2 concurrent submission by ${user.delegate.fullName}`,
          status: 'pending',
        };

        const { data, error } = await user.userClient
          .from('motions')
          .insert(payload)
          .select('id')
          .single();

        const elapsedMs = performance.now() - started;

        return {
          ok: !error,
          elapsedMs,
          status: error ? 0 : 201,
          motionId: data?.id || null,
          error: error?.message,
        };
      })
    );

    for (const result of submissionResults) {
      submissionLatencies.push(result.elapsedMs);
      submissionStatuses.push(result.status);
      if (result.motionId) {
        createdMotionIds.push(result.motionId);
      }
    }
  }

  let voteMotionId = null;

  if (votingPeriod) {
    const motionType = motionTypeForPeriod(votingPeriod.period_type);
    const authorId = users[0].delegate.id;

    const { data: seededMotion, error: seededMotionError } = await adminClient
      .from('motions')
      .insert({
        period_id: votingPeriod.id,
        author_id: authorId,
        motion_type: motionType,
        article_ref: `LT-VOTE-ART-${Date.now()}`,
        section_ref: 'LT-VOTE-SEC',
        original_text: motionType === 'insertion' ? null : 'Load test original vote text',
        proposed_text: motionType === 'quash' ? null : 'Load test proposed vote text',
        justification: 'Seeded for Phase 2 vote concurrency test',
        status: 'pending',
      })
      .select('id')
      .single();

    if (seededMotionError || !seededMotion) {
      throw new Error(`Failed seeding votation motion: ${seededMotionError?.message || 'unknown error'}`);
    }

    voteMotionId = seededMotion.id;
    createdMotionIds.push(seededMotion.id);

    const voteResults = await Promise.all(
      voteWriters.map(async (user, index) => {
        const started = performance.now();
        const voteValue = index % 3 === 0 ? 'adapt' : index % 3 === 1 ? 'quash' : 'abstain';

        const { error } = await user.userClient.rpc('cast_vote', {
          p_motion_id: voteMotionId,
          p_voter_id: user.delegate.id,
          p_value: voteValue,
        });

        const elapsedMs = performance.now() - started;

        return {
          ok: !error,
          elapsedMs,
          status: error ? 0 : 201,
          error: error?.message,
        };
      })
    );

    for (const result of voteResults) {
      voteLatencies.push(result.elapsedMs);
      voteStatuses.push(result.status);
    }
  }

  return {
    submission: {
      total: submissionStatuses.length,
      success: submissionStatuses.filter((status) => status === 201).length,
      successRate:
        submissionStatuses.length > 0
          ? submissionStatuses.filter((status) => status === 201).length / submissionStatuses.length
          : 0,
      p50Ms: percentile(submissionLatencies, 50),
      p95Ms: percentile(submissionLatencies, 95),
      p99Ms: percentile(submissionLatencies, 99),
      maxMs: submissionLatencies.length > 0 ? Math.max(...submissionLatencies) : 0,
    },
    votes: {
      total: voteStatuses.length,
      success: voteStatuses.filter((status) => status === 201).length,
      successRate:
        voteStatuses.length > 0
          ? voteStatuses.filter((status) => status === 201).length / voteStatuses.length
          : 0,
      p50Ms: percentile(voteLatencies, 50),
      p95Ms: percentile(voteLatencies, 95),
      p99Ms: percentile(voteLatencies, 99),
      maxMs: voteLatencies.length > 0 ? Math.max(...voteLatencies) : 0,
      motionId: voteMotionId,
    },
    createdMotionIds,
  };
}

async function ensureWritablePeriods(adminClient, periods) {
  const updates = [];

  let submissionPeriod = resolveSubmissionPeriod(periods);
  let votingPeriod = resolveVotingPeriod(periods);

  if (!submissionPeriod) {
    const candidate =
      periods.find((period) => period.period_type === 'quick_motion') ||
      periods.find((period) => period.period_type === 'amendment') ||
      periods.find((period) => period.period_type === 'insertion') ||
      periods.find((period) => period.period_type === 'quash') ||
      null;

    if (candidate) {
      updates.push({ id: candidate.id, from: candidate.state, to: 'active' });
      submissionPeriod = { ...candidate, state: 'active' };
    }
  }

  if (!votingPeriod) {
    const preferredIds = new Set(submissionPeriod ? [submissionPeriod.id] : []);

    const candidate =
      periods.find((period) => !preferredIds.has(period.id) && period.period_type === 'final_votation') ||
      periods.find((period) => !preferredIds.has(period.id) && period.period_type === 'quick_motion') ||
      periods.find((period) => !preferredIds.has(period.id) && period.period_type === 'amendment') ||
      periods.find((period) => !preferredIds.has(period.id) && period.period_type === 'insertion') ||
      periods.find((period) => !preferredIds.has(period.id) && period.period_type === 'quash') ||
      null;

    if (candidate) {
      updates.push({ id: candidate.id, from: candidate.state, to: 'votation' });
      votingPeriod = { ...candidate, state: 'votation' };
    }
  }

  for (const update of updates) {
    const { error } = await withRetry(() =>
      adminClient
        .from('periods')
        .update({ state: update.to, deadline: null })
        .eq('id', update.id)
    );

    if (error) {
      throw new Error(`Failed updating period ${update.id} -> ${update.to}: ${error.message}`);
    }
  }

  return {
    submissionPeriod,
    votingPeriod,
    updates,
  };
}

async function restorePeriodStates(adminClient, updates) {
  for (const update of updates) {
    const { error } = await withRetry(() =>
      adminClient
        .from('periods')
        .update({ state: update.from, deadline: null })
        .eq('id', update.id)
    );

    if (error) {
      throw new Error(`Failed restoring period ${update.id} -> ${update.from}: ${error.message}`);
    }
  }
}

async function runRealtimeCheck({ users, adminClient, votingPeriod }) {
  if (!adminClient || !votingPeriod || users.length < REALTIME_SUBSCRIBERS + 1) {
    return {
      skipped: true,
      reason: 'Insufficient users or missing voting context for realtime check.',
    };
  }

  const freshMotionType = motionTypeForPeriod(votingPeriod.period_type);
  const seedAuthorId = users[0].delegate.id;

  const { data: freshMotion, error: freshMotionError } = await adminClient
    .from('motions')
    .insert({
      period_id: votingPeriod.id,
      author_id: seedAuthorId,
      motion_type: freshMotionType,
      article_ref: 'LT-RT-ART',
      section_ref: 'LT-RT-SEC',
      original_text:
        freshMotionType === 'insertion' ? null : 'Realtime test original text',
      proposed_text:
        freshMotionType === 'quash' ? null : 'Realtime test proposed text',
      justification: 'Phase 2 realtime verification motion',
      status: 'pending',
    })
    .select('id')
    .single();

  if (freshMotionError || !freshMotion) {
    return {
      skipped: true,
      reason: `Failed creating realtime verification motion: ${freshMotionError?.message || 'unknown error'}`,
    };
  }

  const motionId = freshMotion.id;

  const subscribers = users.slice(0, REALTIME_SUBSCRIBERS);
  const writers = users.slice(-5);
  const receivedBySubscriber = new Map();
  const channels = [];

  for (const subscriber of subscribers) {
    receivedBySubscriber.set(subscriber.delegate.id, 0);

    const channel = subscriber.userClient
      .channel(`phase2-votes-${subscriber.delegate.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'votes',
          filter: `motion_id=eq.${motionId}`,
        },
        () => {
          receivedBySubscriber.set(
            subscriber.delegate.id,
            (receivedBySubscriber.get(subscriber.delegate.id) || 0) + 1
          );
        }
      );

    channels.push({ client: subscriber.userClient, channel });

    await new Promise((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          resolve();
        }
      });
    });
  }

  await Promise.all(
    writers.map(async (writer, index) => {
      const voteValue = index % 2 === 0 ? 'adapt' : 'abstain';
      await writer.userClient.rpc('cast_vote', {
        p_motion_id: motionId,
        p_voter_id: writer.delegate.id,
        p_value: voteValue,
      });
    })
  );

  await sleep(REALTIME_TIMEOUT_MS);

  for (const entry of channels) {
    await entry.client.removeChannel(entry.channel);
  }

  const subscriberCount = subscribers.length;
  const successfulSubscribers = Array.from(receivedBySubscriber.values()).filter((count) => count > 0).length;
  const coverage = subscriberCount > 0 ? successfulSubscribers / subscriberCount : 0;

  return {
    skipped: false,
    motionId,
    subscriberCount,
    successfulSubscribers,
    coverage,
    counts: Object.fromEntries(receivedBySubscriber.entries()),
  };
}

function evaluateResults({ authStats, routeStats, writeStats, realtimeStats }) {
  const findings = [];

  if (authStats.failures > 0) {
    findings.push(`Auth failures: ${authStats.failures}`);
  }

  for (const stat of routeStats) {
    if (stat.successRate < THRESHOLDS.route.minSuccessRate) {
      findings.push(
        `Route ${stat.route} success rate ${(stat.successRate * 100).toFixed(1)}% below ${(THRESHOLDS.route.minSuccessRate * 100).toFixed(1)}%`
      );
    }

    if (stat.p95Ms > THRESHOLDS.route.maxP95Ms) {
      findings.push(
        `Route ${stat.route} p95 ${formatMs(stat.p95Ms)} above ${formatMs(THRESHOLDS.route.maxP95Ms)}`
      );
    }
  }

  if (writeStats.submission.total > 0) {
    if (writeStats.submission.successRate < THRESHOLDS.writes.minSuccessRate) {
      findings.push(
        `Submission success rate ${(writeStats.submission.successRate * 100).toFixed(1)}% below ${(THRESHOLDS.writes.minSuccessRate * 100).toFixed(1)}%`
      );
    }

    if (writeStats.submission.p95Ms > THRESHOLDS.writes.maxP95Ms) {
      findings.push(
        `Submission p95 ${formatMs(writeStats.submission.p95Ms)} above ${formatMs(THRESHOLDS.writes.maxP95Ms)}`
      );
    }
  }

  if (writeStats.votes.total > 0) {
    if (writeStats.votes.successRate < THRESHOLDS.writes.minSuccessRate) {
      findings.push(
        `Vote success rate ${(writeStats.votes.successRate * 100).toFixed(1)}% below ${(THRESHOLDS.writes.minSuccessRate * 100).toFixed(1)}%`
      );
    }

    if (writeStats.votes.p95Ms > THRESHOLDS.writes.maxP95Ms) {
      findings.push(`Vote p95 ${formatMs(writeStats.votes.p95Ms)} above ${formatMs(THRESHOLDS.writes.maxP95Ms)}`);
    }
  }

  if (!realtimeStats.skipped && realtimeStats.coverage < THRESHOLDS.realtime.minSubscriberCoverage) {
    findings.push(
      `Realtime subscriber coverage ${(realtimeStats.coverage * 100).toFixed(1)}% below ${(THRESHOLDS.realtime.minSubscriberCoverage * 100).toFixed(1)}%`
    );
  }

  return {
    passed: findings.length === 0,
    findings,
  };
}

function renderReport({
  startedAt,
  baseUrl,
  delegatesRequested,
  delegatesCreated,
  authStats,
  topology,
  routeStats,
  writeStats,
  realtimeStats,
  evaluation,
}) {
  const lines = [];

  lines.push('# Phase 2 Load Test Report');
  lines.push('');
  lines.push(`- Date: ${new Date(startedAt).toISOString()}`);
  lines.push(`- Base URL: ${baseUrl}`);
  lines.push(`- Delegates requested: ${delegatesRequested}`);
  lines.push(`- Delegates created during run: ${delegatesCreated}`);
  lines.push(`- Delegates authenticated: ${authStats.successes}/${authStats.successes + authStats.failures}`);
  lines.push(`- Active session: ${topology.session.name}`);
  lines.push('');

  lines.push('## Auth');
  lines.push(`- Success rate: ${((authStats.successes / (authStats.successes + authStats.failures || 1)) * 100).toFixed(1)}%`);
  lines.push(`- p95 login latency: ${formatMs(authStats.p95Ms)}`);
  lines.push('');

  lines.push('## Authenticated Route Flows');
  for (const stat of routeStats) {
    lines.push(`- ${stat.route}: success ${(stat.successRate * 100).toFixed(1)}%, p95 ${formatMs(stat.p95Ms)}, p99 ${formatMs(stat.p99Ms)}`);
  }
  lines.push('');

  lines.push('## Concurrent Writes');
  lines.push(
    `- Motion submissions: ${writeStats.submission.success}/${writeStats.submission.total} success, p95 ${formatMs(writeStats.submission.p95Ms)}`
  );
  lines.push(`- Vote submissions: ${writeStats.votes.success}/${writeStats.votes.total} success, p95 ${formatMs(writeStats.votes.p95Ms)}`);
  lines.push('');

  lines.push('## Realtime');
  if (realtimeStats.skipped) {
    lines.push(`- Skipped: ${realtimeStats.reason}`);
  } else {
    lines.push(
      `- Coverage: ${(realtimeStats.coverage * 100).toFixed(1)}% (${realtimeStats.successfulSubscribers}/${realtimeStats.subscriberCount} subscribers received events)`
    );
  }
  lines.push('');

  lines.push('## Verdict');
  lines.push(`- PASS: ${evaluation.passed ? 'YES' : 'NO'}`);
  if (evaluation.findings.length === 0) {
    lines.push('- Bottlenecks detected: none');
  } else {
    for (const finding of evaluation.findings) {
      lines.push(`- ${finding}`);
    }
  }

  return lines.join('\n');
}

async function main() {
  const startedAt = Date.now();
  const envPath = path.resolve('.env.local');

  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local not found.');
  }

  const env = parseEnvFile(envPath);
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing required env key: ${key}`);
    }
  }

  const baseUrl = process.env.LOADTEST_BASE_URL || env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const serviceRoleKey =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    null;

  let adminClient = null;
  let delegates = [];
  let created = 0;
  let auth;

  if (serviceRoleKey) {
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    console.log(`Ensuring ${TOTAL_DELEGATES} load-test delegates...`);
    const ensured = await ensureDelegates(adminClient);
    delegates = ensured.delegates;
    created = ensured.created;

    console.log('Authenticating delegates...');
    auth = await authenticateDelegates(env, delegates);
  } else if (USERS_FILE) {
    delegates = loadDelegatesFromUsersFile(USERS_FILE);
    if (delegates.length < TOTAL_DELEGATES) {
      throw new Error(
        `LOADTEST_USERS_FILE includes ${delegates.length} users but ${TOTAL_DELEGATES} are required.`
      );
    }

    console.log(`Using ${delegates.length} delegates from LOADTEST_USERS_FILE...`);
    auth = await authenticateDelegatesWithIndividualPasswords(env, delegates.slice(0, TOTAL_DELEGATES));
  } else {
    throw new Error(
      'Missing service-role access for account provisioning. Set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY), or provide LOADTEST_USERS_FILE with 65 credential entries.'
    );
  }

  const authLatencyMs = auth.authLatencyMs;
  const authStats = {
    successes: auth.authenticated.length,
    failures: auth.failures.length,
    p95Ms: percentile(authLatencyMs, 95),
    p99Ms: percentile(authLatencyMs, 99),
  };

  if (auth.authenticated.length < TOTAL_DELEGATES) {
    console.log('Authentication failures detected:');
    for (const failure of auth.failures.slice(0, 10)) {
      console.log(`- ${failure.delegate.email}: ${failure.reason}`);
    }
  }

  if (auth.authenticated.length === 0) {
    throw new Error('No delegates authenticated. Aborting Phase 2 test.');
  }

  console.log('Loading active session topology...');
  const topologyClient = adminClient || auth.authenticated[0].userClient;
  const topology = await fetchActiveTopology(topologyClient);

  console.log('Running authenticated route simulations...');
  const routeStats = [];
  routeStats.push(await runRouteSimulation(baseUrl, auth.authenticated, '/home'));
  routeStats.push(await runRouteSimulation(baseUrl, auth.authenticated, '/periods/amendment'));
  routeStats.push(await runRouteSimulation(baseUrl, auth.authenticated, '/quick-motion'));

  let submissionPeriod = resolveSubmissionPeriod(topology.periods);
  let votingPeriod = resolveVotingPeriod(topology.periods);
  let temporaryPeriodUpdates = [];

  console.log('Running concurrent write tests...');
  if (!adminClient) {
    throw new Error(
      'Concurrent write stage requires service-role key to seed votation motion safely when needed. Provide SUPABASE_SERVICE_ROLE_KEY to continue.'
    );
  }

  let writeStats;
  let realtimeStats;

  try {
    const writable = await ensureWritablePeriods(adminClient, topology.periods);
    submissionPeriod = writable.submissionPeriod;
    votingPeriod = writable.votingPeriod;
    temporaryPeriodUpdates = writable.updates;

    writeStats = await runConcurrentWrites({
      adminClient,
      users: auth.authenticated,
      submissionPeriod,
      votingPeriod,
    });

    console.log('Running realtime fanout check...');
    realtimeStats = await runRealtimeCheck({
      users: auth.authenticated,
      adminClient,
      votingPeriod,
    });
  } finally {
    if (temporaryPeriodUpdates.length > 0) {
      try {
        await restorePeriodStates(adminClient, temporaryPeriodUpdates);
      } catch (restoreError) {
        const message =
          restoreError instanceof Error ? restoreError.message : String(restoreError);
        console.warn(`Warning: failed to restore period states cleanly: ${message}`);
      }
    }
  }

  const evaluation = evaluateResults({
    authStats,
    routeStats,
    writeStats,
    realtimeStats,
  });

  const reportText = renderReport({
    startedAt,
    baseUrl,
    delegatesRequested: TOTAL_DELEGATES,
    delegatesCreated: created,
    authStats,
    topology,
    routeStats,
    writeStats,
    realtimeStats,
    evaluation,
  });

  const reportsDir = path.resolve('reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const stamp = new Date(startedAt).toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportsDir, `phase2-loadtest-${stamp}.md`);
  const jsonPath = path.join(reportsDir, `phase2-loadtest-${stamp}.json`);

  fs.writeFileSync(reportPath, reportText, 'utf8');
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        startedAt,
        baseUrl,
        delegatesRequested: TOTAL_DELEGATES,
        delegatesCreated: created,
        authStats,
        topology,
        routeStats,
        writeStats,
        realtimeStats,
        evaluation,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('');
  console.log(reportText);
  console.log('');
  console.log(`Saved report: ${reportPath}`);
  console.log(`Saved report JSON: ${jsonPath}`);

  if (!evaluation.passed) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
