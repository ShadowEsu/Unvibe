begin;

-- Pro: 200 explanations a month (was 100; Preston, ledger 417). The statement is part 5 of the
-- Security-reviewed tiers kit (billing/enterprise-business-tiers, 20261031090000_enterprise_business_tiers.sql),
-- taken alone: Free stays 50, Teams stays 100, no new plans. It reaches every existing Pro row
-- (paid, promo, gift and welcome-month Pro) at once, because usage limits are read from
-- plan_entitlements on every reservation. Rollback: the same update with 100.
update plan_entitlements set ai_explanations = 200, updated_at = now() where plan = 'pro' and ai_explanations <> 200;

commit;
