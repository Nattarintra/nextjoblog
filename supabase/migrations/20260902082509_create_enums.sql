create type application_status as enum (
  'interested',
  'preparing',
  'applied',
  'recruiter_contacted',
  'interview_scheduled',
  'technical_test',
  'reference_check',
  'offer_received',
  'rejected',
  'withdrawn'
);

create type work_format as enum ('on_site', 'hybrid', 'remote');
create type contract_type as enum ('permanent', 'consultant', 'internship', 'contract');
create type discipline as enum ('frontend', 'fullstack', 'backend', 'tester_qa');
create type document_type as enum ('cv', 'cover_letter');
create type reminder_type as enum ('follow_up', 'interview', 'technical_test');
