// /lib/notion.ts
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

type AnyProp = any;

function plain(rtArray: AnyProp[] = []) {
  return rtArray.map(r => r?.plain_text ?? "").join("").trim();
}

// 统一取文本（兼容 Title / Rich text / URL）
function pickText(prop?: AnyProp): string {
  if (!prop) return "";
  if (prop.type === "title") return plain(prop.title);
  if (prop.type === "rich_text") return plain(prop.rich_text);
  if (prop.type === "url") return prop.url || "";
  return "";
}

// 规范化封面：兼容 URL / Files & media
function pickCover(prop?: AnyProp): string | undefined {
  if (!prop) return undefined;
  if (prop.type === "url") return prop.url || undefined;
  if (prop.type === "files" && Array.isArray(prop.files) && prop.files.length) {
    const f = prop.files[0];
    if (f?.type === "file") return f.file?.url;
    if (f?.type === "external") return f.external?.url;
  }
  return undefined;
}

// 规范化作者：Text 或 People
function pickAuthor(prop?: AnyProp): string {
  if (!prop) return "Unknown";
  if (prop.type === "rich_text") return plain(prop.rich_text) || "Unknown";
  if (prop.type === "people" && prop.people?.length) {
    return prop.people.map((p: AnyProp) => p?.name || p?.person?.email || "Unknown").join(", ");
  }
  if (prop.type === "title") return plain(prop.title);
  return "Unknown";
}

export type Post = {
  id: string;
  title: string;
  excerpt: string;
  slug: string;
  coverImage: string | null;
  date: string | null;
  author: string;
  content: string;
};

// 列表：按 date 倒序
export async function getPosts(): Promise<Post[]> {
  // 用 any 强转临时绕过老版本类型缺少 query 的问题
  const res = await (notion as any).databases.query({
    database_id: process.env.NOTION_DATABASE_ID!,
    sorts: [{ property: "date", direction: "descending" }],
  });

  return res.results
    .map((page: AnyProp) => {
      const p = page.properties;
      const title = pickText(p?.Title) || "Untitled";
      const excerpt = pickText(p?.Excerpt) || "";
      const slug = pickText(p?.Slug) || "";
      const coverImage = pickCover(p?.coverImage) || null;
      const date = p?.date?.date?.start || null;
      const author = pickAuthor(p?.author);
      const content = pickText(p?.content) || "";

      return { id: page.id, title, excerpt, slug, coverImage, date, author, content } as Post;
    })
    .filter((x: Post) => Boolean(x.slug));
}

// 详情：按 slug 精确查询
export async function getPostBySlug(slug: string): Promise<Post | null> {
  const res = await (notion as any).databases.query({
    database_id: process.env.NOTION_DATABASE_ID!,
    filter: { property: "Slug", rich_text: { equals: slug } },
    page_size: 1,
  });

  if (!res.results.length) return null;
  const page = res.results[0] as AnyProp;
  const p = page.properties;

  return {
    id: page.id,
    title: pickText(p?.Title) || "Untitled",
    excerpt: pickText(p?.Excerpt) || "",
    slug: pickText(p?.Slug) || "",
    coverImage: pickCover(p?.coverImage) || null,
    date: p?.date?.date?.start || null,
    author: pickAuthor(p?.author),
    content: pickText(p?.content) || "",
  };
}

// 生成静态参数：所有 slug
export async function getAllSlugs(): Promise<{ slug: string }[]> {
  const res = await (notion as any).databases.query({
    database_id: process.env.NOTION_DATABASE_ID!,
    filter: { property: "Slug", rich_text: { is_not_empty: true } },
  });

  return res.results
    .map((pg: AnyProp) => ({ slug: pickText(pg?.properties?.Slug) }))
    .filter((x: { slug: string }) => Boolean(x.slug));
}
