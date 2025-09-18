import { getPosts } from "@/lib/notion";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DebugNotion() {
  const posts = await getPosts();
  return (
    <pre style={{padding:16, whiteSpace:"pre-wrap"}}>
      {JSON.stringify({
        count: posts.length,
        first: posts[0] || null,
        env: {
          hasToken: Boolean(process.env.NOTION_TOKEN),
          hasDb: Boolean(process.env.NOTION_DATABASE_ID),
        }
      }, null, 2)}
    </pre>
  );
}
