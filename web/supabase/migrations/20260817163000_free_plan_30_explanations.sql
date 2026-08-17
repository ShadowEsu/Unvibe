-- Free monthly AI explanations: 30. Pro and Teams stay at 100.
update plan_entitlements
set
  ai_explanations = 30,
  updated_at = now()
where plan = 'free';
