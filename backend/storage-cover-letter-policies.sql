-- Cover letter image storage: RLS policies for Supabase SQL Editor
-- Run in Supabase Dashboard → SQL Editor
--
-- Prerequisite: Create bucket "cover-letter" in Dashboard → Storage → New bucket (Private).
-- Then run the policies below.

-- Drop existing policies so this script is idempotent
DROP POLICY IF EXISTS "cover_letter_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "cover_letter_select_own_folder" ON storage.objects;

-- INSERT: authenticated users can upload only to a folder named their user id
CREATE POLICY "cover_letter_insert_own_folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cover-letter'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- SELECT: authenticated users can read only their own objects (needed for signed URLs via app)
CREATE POLICY "cover_letter_select_own_folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'cover-letter'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);
