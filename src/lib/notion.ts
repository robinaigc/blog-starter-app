// src/lib/notion.ts
import { Client } from "@notionhq/client";
const notion = new Client({ auth: process.env.NOTION_TOKEN });

type AnyProp = any;

function plain(rtArray: AnyProp[] = []) {
  return rtArray.map(r => r?.plain_text ?? "").join("").trim();
}

// 不区分大小写取属性：同时兼容 Title/title、coverImage/coverimage、author/Author 等
function getPropCI(p: AnyProp, ...names: string[]) {
  if (!p) return undefined;
  const map = Object.fromEntries(Object.keys(p).map(k => [k.toLowerCase(), k]));
  for (const n of names) {
    const key = map[n.toLowerCase()];
    if (key) return p[key];
  }
  return undefined;
}

function pickText(prop?: AnyProp): string {
  if (!prop) return "";
  if (prop.type === "title") return plain(prop.title);
  if (prop.type === "rich_text") return plain(prop.rich_text);
  if (prop.type === "url") return prop.url || "";
  return "";
}

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

// 拉取并规范化一批 Notion 记录
async function fetchBatch(pageSize = 100): Promise<Post[]> {
  const res = await (notion as any).databases.query({
    database_id: process.env.NOTION_DATABASE_ID!,
    sorts: [{ property: "date", direction: "descending" }],
    page_size: pageSize,
  });

  return res.results.map((page: AnyProp) => {
    const p = page.properties;
    const title = pickText(getPropCI(p, "Title", "title")) || "Untitled";
    const excerpt = pickText(getPropCI(p, "Excerpt", "excerpt")) || "";
    const s1 = pickText(getPropCI(p, "Slug", "slug"));
    const s2 = title.toLowerCase().replace(/\s+/g, "-"); // 兜底：由标题推导
    const slug = s1 || s2;
    const coverImage = pickCover(getPropCI(p, "coverImage", "coverimage")) || null;
    const dateProp = getPropCI(p, "date", "Date");
    const date = dateProp?.date?.start || null;
    const author = pickAuthor(getPropCI(p, "author", "Author"));
    const content = pickText(getPropCI(p, "content", "Content")) || "";
    return { id: page.id, title, excerpt, slug, coverImage, date, author, content };
  });
}

// 列表
export async function getPosts(): Promise<Post[]> {
  const items = await fetchBatch(100);
  return items.filter(x => Boolean(x.slug));
}

// 详情：内存里忽略大小写匹配 slug
export async function getPostBySlug(slug: string): Promise<Post | null> {
  const items = await fetchBatch(100);
  const hit = items.find(it => it.slug?.toLowerCase() === slug.toLowerCase());
  return hit ?? null;
}

// 生成静态参数：宽松导出
export async function getAllSlugs(): Promise<{ slug: string }[]> {
  const items = await fetchBatch(100);
  return items
    .map(it => ({ slug: it.slug }))
    .filter((x: { slug: string }) => Boolean(x.slug));
}
