import { createFileRoute } from "@tanstack/react-router";
import { Heart, MessageCircle, Trophy, UserPlus, Users } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/soliq/AppShell";
import { SectionTitle } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { communityPosts, leaderboard } from "@/lib/market-data";

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
  const [posts, setPosts] = useState(communityPosts);
  const [draft, setDraft] = useState("");
  const [liked, setLiked] = useState<string[]>([]);

  const publish = () => {
    if (!draft.trim()) return;
    setPosts([
      {
        id: `local-${posts.length}`,
        author: "You",
        handle: "@guest",
        role: "Explorer",
        rep: 120,
        time: "now",
        body: draft.trim(),
        likes: 0,
        comments: 0,
        tags: ["Idea"],
      },
      ...posts,
    ]);
    setDraft("");
  };

  return (
    <AppShell>
      <h1 className="flex items-center gap-2 text-xl font-bold lg:text-2xl">
        <Users className="size-5 text-primary" /> Community
      </h1>
      <p className="text-sm text-muted-foreground">Ideas, research and reputation from serious investors.</p>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <div className="panel p-4">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Share a market idea, setup or thesis…"
              className="min-h-20 resize-none border-border bg-surface-2/40"
            />
            <div className="mt-3 flex justify-end">
              <Button variant="hero" size="sm" onClick={publish}>
                Post idea
              </Button>
            </div>
          </div>

          {posts.map((p) => {
            const isLiked = liked.includes(p.id);
            return (
              <article key={p.id} className="panel p-5">
                <header className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {p.author.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {p.author} <span className="text-[11px] text-muted-foreground">{p.handle}</span>
                    </p>
                    <p className="num text-[11px] text-muted-foreground">
                      {p.role} · rep {p.rep.toLocaleString()} · {p.time}
                    </p>
                  </div>
                  <Button variant="subtle" size="sm" className="ml-auto">
                    <UserPlus className="size-4" /> Follow
                  </Button>
                </header>
                <p className="mt-3 text-sm leading-relaxed">{p.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.tags.map((t) => (
                    <span key={t} className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] text-muted-foreground">
                      #{t}
                    </span>
                  ))}
                </div>
                <footer className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <button
                    onClick={() => setLiked(isLiked ? liked.filter((i) => i !== p.id) : [...liked, p.id])}
                    className={`flex items-center gap-1.5 ${isLiked ? "text-primary" : "hover:text-foreground"}`}
                  >
                    <Heart className="size-4" /> <span className="num">{p.likes + (isLiked ? 1 : 0)}</span>
                  </button>
                  <span className="flex items-center gap-1.5">
                    <MessageCircle className="size-4" /> <span className="num">{p.comments}</span>
                  </span>
                </footer>
              </article>
            );
          })}
        </section>

        <aside className="panel h-fit p-5">
          <SectionTitle title="Leaderboard" subtitle="Ranked by reputation" action={<Trophy className="size-4 text-warn" />} />
          <div className="divide-y divide-border/60">
            {leaderboard.map((u, i) => (
              <div key={u.handle} className="flex items-center gap-3 py-3">
                <span className="num w-5 text-xs text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.name}</p>
                  <p className="text-[11px] text-muted-foreground">{u.cat}</p>
                </div>
                <div className="text-right">
                  <p className="num text-sm">{u.score.toLocaleString()}</p>
                  <p className="num text-[11px] text-bull">{u.win}% hit rate</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
