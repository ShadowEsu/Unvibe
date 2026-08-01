-- Align SQL entitlements with Free 50 / Pro 100 monthly AI explanations.
update plan_entitlements
set
  ai_explanations = case plan
    when 'free' then 50
    when 'pro' then 100
    when 'teams' then 100
    else ai_explanations
  end,
  updated_at = now()
where plan in ('free', 'pro', 'teams');
