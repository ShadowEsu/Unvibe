export interface StagingConfig {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  webBaseUrl: string;
  allowDestructive: boolean;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required staging variable: ${name}`);
  return value;
}

export function stagingConfig(env: NodeJS.ProcessEnv = process.env): StagingConfig {
  if (env.APP_ENV !== 'staging') throw new Error('Refusing: APP_ENV must equal staging.');
  if (env.STAGING_CONFIRMATION !== 'UNVIBE_STAGING_ONLY') {
    throw new Error('Refusing: STAGING_CONFIRMATION must equal UNVIBE_STAGING_ONLY.');
  }
  const supabaseUrl = required(env, 'SUPABASE_URL');
  const anonKey = required(env, 'SUPABASE_ANON_KEY');
  const serviceRoleKey = required(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const webBaseUrl = required(env, 'WEB_BASE_URL');
  const projectRef = required(env, 'STAGING_PROJECT_REF');
  const productionRef = env.PRODUCTION_SUPABASE_PROJECT_REF?.trim();
  const allowedHosts = required(env, 'STAGING_ALLOWED_SUPABASE_HOSTS').split(',').map((host) => host.trim());
  const dbUrl = new URL(supabaseUrl);
  const appUrl = new URL(webBaseUrl);
  if (dbUrl.protocol !== 'https:' || appUrl.protocol !== 'https:') throw new Error('Refusing non-HTTPS staging endpoints.');
  if (!allowedHosts.includes(dbUrl.hostname)) throw new Error(`Refusing Supabase host outside allowlist: ${dbUrl.hostname}`);
  if (dbUrl.hostname.split('.')[0] !== projectRef) throw new Error('STAGING_PROJECT_REF does not match SUPABASE_URL.');
  if (productionRef && projectRef === productionRef) throw new Error('Refusing: staging and production Supabase refs match.');
  if (env.PRODUCTION_WEB_BASE_URL && new URL(env.PRODUCTION_WEB_BASE_URL).origin === appUrl.origin) {
    throw new Error('Refusing: staging and production web origins match.');
  }
  if (env.STRIPE_SECRET_KEY?.startsWith('sk_live_')) throw new Error('Refusing a live Stripe key.');
  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    webBaseUrl: appUrl.origin,
    allowDestructive: env.STAGING_ALLOW_DESTRUCTIVE_TESTS === 'true',
  };
}
