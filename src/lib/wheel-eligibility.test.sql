-- Each expression must return true. Exercises the actual database eligibility rule without crediting balances.
SELECT
 public.wheel_audience_eligible('all',true,'2026-10-01','2026-10-19',false,false,false) AS activated_round,
 NOT public.wheel_audience_eligible('all',false,'2026-10-01','2026-10-19',true,true,false) AS inactive_blocked,
 public.wheel_audience_eligible('welcome',true,'2026-10-20','2026-10-19',false,false,false) AS new_welcome,
 NOT public.wheel_audience_eligible('welcome',true,'2026-10-18','2026-10-19',false,false,false) AS old_account_blocked,
 NOT public.wheel_audience_eligible('welcome',true,'2026-10-20','2026-10-19',false,false,true) AS repeat_welcome_blocked,
 public.wheel_audience_eligible('referral',true,'2026-10-01','2026-10-19',true,false,false) AS referral_allowed,
 NOT public.wheel_audience_eligible('referral',true,'2026-10-01','2026-10-19',false,false,false) AS no_referral_blocked,
 public.wheel_audience_eligible('selected',true,'2026-10-01','2026-10-19',false,true,false) AS selected_allowed,
 NOT public.wheel_audience_eligible('selected',true,'2026-10-01','2026-10-19',false,false,false) AS unselected_blocked;