insert into storage.buckets (id, name, public)
values ('cv-documents', 'cv-documents', false);

create policy "cv_documents_storage_select" on storage.objects
  for select using (bucket_id = 'cv-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "cv_documents_storage_insert" on storage.objects
  for insert with check (bucket_id = 'cv-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "cv_documents_storage_delete" on storage.objects
  for delete using (bucket_id = 'cv-documents' and auth.uid()::text = (storage.foldername(name))[1]);
