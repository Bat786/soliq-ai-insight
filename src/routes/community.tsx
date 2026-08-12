import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Trophy, Users } from "lucide-react";
import { useState } from "react";

import { AppShell, MemberBadge } from "@/components/soliq/AppShell";
import { SectionTitle } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useProfile, useSession } from "@/hooks/use-soliq-account";
import { isPaid } from "@/lib/membership";
import { createCommunityPost } from "@/lib/soliq.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community — Social Investing on SOLIQ" },
      {
        name: "description",
        content:
          "Follow top analysts, traders and researchers, share market ideas and build reputation in the SOLIQ investing community.",
      },
      { property: "og:title", content: "Community — SOLIQ" },
      { property: "og:description", content: "Share ideas, follow investors and climb the SOLIQ leaderboards." },
    ],
  }),
  component: Community,
});

function Community() {
  const [draft, setDraft] = useState("");

  const { isSignedIn } = useSession();
  const { data: profile, tier } = useProfile();
  const queryClient = useQueryClient();
  const submitPost = useServerFn(createCommunityPost);
  const canPost = isSignedIn && isPaid(tier);

  const memberPosts = useQuery({
    queryKey: ["community-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select("id, body, tags, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      const ids = [...new Set((data ?? []).map((p) => p.user_id))];
      const profiles = ids.length
        ? (await supabase.from("profiles").select("id, display_name, handle, membership_tier").in("id", ids)).data ?? []
        : [];
      return (data ?? []).map((p) => {
        const author = profiles.find((pr) => pr.id === p.user_id);
        return {
          id: p.id,
          author: author?.display_name ?? "SOLIQ Member",
          handle: author?.handle ?? "@member",
          tier: (author?.membership_tier ?? "free") as "free" | "pro" | "elite",
          body: p.body,
          tags: p.tags ?? [],
          created_at: p.created_at,
        };
      });
    },
  });

  const publish = useMutation({
    mutationFn: () => submitPost({ data: { body: draft.trim() } }),
    onSuccess: (res) => {
      if (res.needsUpgrade) {
        toast.error("Posting is for Pro and Elite members — it keeps spam and bots out.");
        return;
      }
      setDraft("");
      toast.success("Idea published to the community.");
      void queryClient.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: () => toast.error("Could not publish that post."),
  });

  const leaders = Object.values(
    (memberPosts.data ?? []).reduce<Record<string, { author: string; handle: string; tier: "free" | "pro" | "elite"; posts: number }>>(
      (acc, p) => {
        const key = p.handle;
        acc[key] = { author: p.author, handle: p.handle, tier: p.tier, posts: (acc[key]?.posts ?? 0) + 1 };
        return acc;
      },
      {},
    ),
  )
    .sort((a, b) => b.posts - a.posts)
    .slice(0, 10);

  return (
    <AppShell>
      <h1 className="flex items-center gap-2 text-xl font-bold lg:text-2xl">
        <Users className="size-5 text-primary" /> Community
      </h1>
      <p className="text-sm text-muted-foreground">Ideas, research and reputation from serious investors.</p>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <div className="panel p-4">
            {canPost ? (
              <>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  Posting as {profile?.display_name ?? "you"} <MemberBadge tier={tier} />
                </div>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Share a market idea, setup or thesis…"
                  className="mt-2 min-h-20 resize-none border-border bg-surface-2/40"
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="hero"
                    size="sm"
                    disabled={draft.trim().length < 3 || publish.isPending}
                    onClick={() => publish.mutate()}
                  >
                    Post idea
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/12 text-primary">
                  <Lock className="size-4" />
                </span>
                <div className="min-w-40 flex-1">
                  <p className="text-sm font-medium">Posting is for Premium members</p>
                  <p className="text-[11px] text-muted-foreground">
                    Requiring a paid membership to post keeps spam and bots out of the feed.
                  </p>
                </div>
                <Button asChild variant="hero" size="sm">
                  <Link to={isSignedIn ? "/pricing" : "/auth"}>{isSignedIn ? "Go Premium" : "Sign in"}</Link>
                </Button>
              </div>
            )}
          </div>

          {(memberPosts.data ?? []).map((p) => (
            <article key={p.id} className="panel p-5">
              <header className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {p.author.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {p.author} <MemberBadge tier={p.tier} />
                    <span className="text-[11px] text-muted-foreground">{p.handle}</span>
                  </p>
                  <p className="num text-[11px] text-muted-foreground">
                    {new Date(p.created_at).toLocaleString()}
                  </p>
                </div>
              </header>
              <p className="mt-3 text-sm leading-relaxed">{p.body}</p>
            </article>
          ))}

          {!memberPosts.data?.length && (
            <p className="panel p-8 text-center text-sm text-muted-foreground">
              No ideas posted yet — Premium members can start the conversation.
            </p>
          )}
        </section>

        <aside className="panel h-fit p-5">
          <SectionTitle title="Leaderboard" subtitle="Ranked by published ideas" action={<Trophy className="size-4 text-warn" />} />
          <div className="divide-y divide-border/60">
            {leaders.map((u, i) => (
              <div key={u.handle} className="flex items-center gap-3 py-3">
                <span className="num w-5 text-xs text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.author}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {u.handle} · {u.tier === "free" ? "Member" : u.tier === "pro" ? "Pro" : "Elite"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-sm">{u.posts}</p>
                  <p className="num text-[11px] text-muted-foreground">ideas</p>
                </div>
              </div>
            ))}
            {!leaders.length && (
              <p className="py-4 text-xs text-muted-foreground">
                The leaderboard fills up as members publish ideas.
              </p>
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
