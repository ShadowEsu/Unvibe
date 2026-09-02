export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url?.startsWith('http') || !key) return;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const { FREE_AI_EXPLANATIONS } = await import('./src/billing/plans');
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await sb
      .from('plan_entitlements')
      .update({ ai_explanations: FREE_AI_EXPLANATIONS, updated_at: new Date().toISOString() })
      .eq('plan', 'free')
      .neq('ai_explanations', FREE_AI_EXPLANATIONS);
    if (error) console.warn('align free explanation cap failed', error.message);
  } catch (err) {
    console.warn('align free explanation cap failed', err instanceof Error ? err.message : err);
  }
}
