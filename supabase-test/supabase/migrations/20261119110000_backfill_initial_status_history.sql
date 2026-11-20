-- Applications created before the record_initial_status trigger have no first
-- status_history row. Give each one a row so history is uniform: the status it
-- has now, stamped at creation time (the true first status is not recoverable).
insert into public.status_history (application_id, user_id, status, changed_at)
select a.id, a.user_id, a.status, a.created_at
from public.applications a
where not exists (
  select 1 from public.status_history h where h.application_id = a.id
);
