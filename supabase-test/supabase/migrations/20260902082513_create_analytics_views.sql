create view public.v_application_counts
  with (security_invoker = true) as
select
  user_id,
  count(*) filter (where applied_date = current_date) as today_count,
  count(*) filter (where applied_date >= date_trunc('week', current_date)::date) as week_count,
  count(*) filter (where applied_date >= date_trunc('month', current_date)::date) as month_count
from public.applications
group by user_id;

create view public.v_status_counts
  with (security_invoker = true) as
select user_id, status, count(*) as count
from public.applications
group by user_id, status;

create view public.v_response_rates
  with (security_invoker = true) as
select
  user_id,
  count(*) as total_applications,
  count(*) filter (where status not in ('interested','preparing','applied')) as responded_count,
  count(*) filter (where status in ('interview_scheduled','technical_test','reference_check','offer_received')) as interview_count,
  round(100.0 * count(*) filter (where status not in ('interested','preparing','applied')) / nullif(count(*), 0), 1) as response_rate_pct,
  round(100.0 * count(*) filter (where status in ('interview_scheduled','technical_test','reference_check','offer_received')) / nullif(count(*), 0), 1) as interview_rate_pct
from public.applications
group by user_id;

create view public.v_website_rankings
  with (security_invoker = true) as
select
  user_id,
  coalesce(nullif(trim(lower(source_website)), ''), 'unknown') as source_website_normalized,
  count(*) as total_applications,
  round(100.0 * count(*) filter (where status not in ('interested','preparing','applied')) / nullif(count(*), 0), 1) as response_rate_pct
from public.applications
group by user_id, coalesce(nullif(trim(lower(source_website)), ''), 'unknown');

create view public.v_cv_rankings
  with (security_invoker = true) as
select
  a.user_id,
  a.cv_document_id,
  cd.version_label,
  count(*) as total_applications,
  round(100.0 * count(*) filter (where a.status not in ('interested','preparing','applied')) / nullif(count(*), 0), 1) as response_rate_pct
from public.applications a
join public.cv_documents cd on cd.id = a.cv_document_id
group by a.user_id, a.cv_document_id, cd.version_label;
