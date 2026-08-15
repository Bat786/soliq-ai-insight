-- Profiles: restrict reads to signed-in members
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by members"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Community posts: members-only feed
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.community_posts;
CREATE POLICY "Posts are viewable by members"
ON public.community_posts
FOR SELECT
TO authenticated
USING (true);

-- Remove anonymous Data API access to both tables
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.community_posts FROM anon;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.community_posts TO service_role;