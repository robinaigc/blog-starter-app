// /app/posts/page.tsx
import Link from "next/link";
import { getPosts } from "@/lib/notion";

export const revalidate = 60;

export default async function PostsIndex() {
  const posts = await getPosts();

  return (
    <main className="mx-auto max-w-3xl py-10 px-4 space-y-6">
      <h1 className="text-3xl font-bold">All Posts</h1>
      <ul className="space-y-4">
        {posts.map(p => (
          <li key={p.id} className="border rounded-xl p-4">
            <Link href={`/posts/${p.slug}`} className="text-xl font-semibold hover:underline">
              {p.title}
            </Link>
            <div className="text-sm text-gray-500">
              {p.date ? new Date(p.date).toLocaleDateString() : ""} · {p.author}
            </div>
            {p.excerpt && <p className="mt-2 text-gray-700">{p.excerpt}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
