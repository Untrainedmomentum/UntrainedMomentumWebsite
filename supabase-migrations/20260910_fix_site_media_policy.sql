-- Fix site-media RLS policies so site slug checks use the uploaded object path.
-- The previous policy referenced s.name inside the correlated subquery, which
-- bound to public.sites.name instead of storage.objects.name and blocked valid uploads.

DROP POLICY IF EXISTS site_media_insert_own_folder ON storage.objects;
CREATE POLICY site_media_insert_own_folder
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'site-media'
  AND (storage.foldername(storage.objects.name))[1] = (SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.disabled = false
  )
  AND EXISTS (
    SELECT 1
    FROM public.sites s
    WHERE s.owner_user_id = (SELECT auth.uid())
      AND s.slug = (storage.foldername(storage.objects.name))[2]
      AND s.status = 'active'
  )
);

DROP POLICY IF EXISTS site_media_update_own_folder ON storage.objects;
CREATE POLICY site_media_update_own_folder
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'site-media'
  AND owner_id = (SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.disabled = false
  )
)
WITH CHECK (
  bucket_id = 'site-media'
  AND (storage.foldername(storage.objects.name))[1] = (SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.disabled = false
  )
  AND EXISTS (
    SELECT 1
    FROM public.sites s
    WHERE s.owner_user_id = (SELECT auth.uid())
      AND s.slug = (storage.foldername(storage.objects.name))[2]
      AND s.status = 'active'
  )
);
