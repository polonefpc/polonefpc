DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'apply-daily-yields') THEN
    PERFORM cron.unschedule('apply-daily-yields');
  END IF;

  PERFORM cron.schedule(
    'apply-daily-yields',
    '14 0 * * *',
    'SELECT public.apply_daily_yields(current_date);'
  );
END $$;