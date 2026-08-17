/*
# Jeopardy Night — Storage bucket for presentations

1. Storage
- Create a public bucket `presentations` for storing uploaded PDF/PPTX files.
- Each game references its own file path. Files are public so all players can
  load them without authenticated access, but the path is a random UUID so it's
  not guessable.

2. Policies
- Allow anon + authenticated to upload (the moderator uploads during game
  creation, before any auth session exists).
- Allow anon + authenticated to read (players need to view the presentation).
- No delete from the client; cleanup is server-side if needed.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('presentations', 'presentations', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_upload_presentations" ON storage.objects;
CREATE POLICY "anon_upload_presentations" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'presentations');

DROP POLICY IF EXISTS "anon_read_presentations" ON storage.objects;
CREATE POLICY "anon_read_presentations" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'presentations');
