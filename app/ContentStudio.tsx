"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChatGPTUser } from "./chatgpt-auth";

type Role = "admin" | "editor";
type PostStatus = "draft" | "published";
type Post = { id: string; title: string; excerpt: string; content: string; status: PostStatus; authorEmail: string; authorName: string; createdAt: string; updatedAt: string };
type Member = { email: string; displayName: string; role: Role; createdAt: string };
type Session = ChatGPTUser & { role: Role };
type View = "content" | "admin";

const emptyDraft = { title: "", excerpt: "", content: "", status: "draft" as PostStatus };

export function ContentStudio({ initialUser, signInPath }: { initialUser: ChatGPTUser | null; signInPath: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [view, setView] = useState<View>("content");
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };

  const loadWorkspace = useCallback(async () => {
    if (!initialUser) return;
    const sessionRes = await fetch("/api/session");
    if (!sessionRes.ok) return;
    const sessionData = await sessionRes.json() as { user: Session };
    setSession(sessionData.user);
    const scope = sessionData.user.role === "admin" ? "all" : "mine";
    const postsRes = await fetch(`/api/posts?scope=${scope}`);
    if (postsRes.ok) setPosts((await postsRes.json()).posts);
    if (sessionData.user.role === "admin") {
      const membersRes = await fetch("/api/users");
      if (membersRes.ok) setMembers((await membersRes.json()).users);
    }
  }, [initialUser]);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

  const stats = useMemo(() => ({
    total: posts.length,
    published: posts.filter((post) => post.status === "published").length,
    drafts: posts.filter((post) => post.status === "draft").length,
  }), [posts]);

  const openCreate = () => { setEditingId(null); setDraft(emptyDraft); setShowEditor(true); };
  const openEdit = (post: Post) => { setEditingId(post.id); setDraft({ title: post.title, excerpt: post.excerpt, content: post.content, status: post.status }); setShowEditor(true); };

  async function savePost() {
    if (!draft.title.trim() || !draft.content.trim()) return notify("请填写标题和正文");
    setBusy(true);
    const response = await fetch(editingId ? `/api/posts/${editingId}` : "/api/posts", {
      method: editingId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    setBusy(false);
    if (!response.ok) return notify("保存失败，请稍后重试");
    setShowEditor(false);
    notify(editingId ? "内容已更新" : "内容已创建");
    await loadWorkspace();
  }

  async function deletePost(id: string) {
    if (!window.confirm("确定删除这篇内容吗？此操作无法撤销。")) return;
    const response = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (!response.ok) return notify("删除失败");
    notify("内容已删除");
    await loadWorkspace();
  }

  async function changeRole(email: string, role: Role) {
    const response = await fetch(`/api/users/${encodeURIComponent(email)}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role }),
    });
    if (!response.ok) return notify("权限更新失败");
    notify("成员权限已更新");
    await loadWorkspace();
  }

  if (!initialUser) {
    return <div className="app-shell">
      <header className="topbar"><div className="brand"><span className="brand-mark">墨</span>墨台</div><a className="button button-primary" href={signInPath}>使用 ChatGPT 登录</a></header>
      <main className="hero">
        <div className="eyebrow">Content operations, simplified</div>
        <h1>让每一份内容，<br />从想法走向发布。</h1>
        <p className="hero-copy">墨台是一套轻量而完整的内容管理工作台。登录后即可创建草稿、协作编辑、统一发布，并通过管理员后台管理团队权限。</p>
        <div className="hero-actions"><a className="button button-primary" href={signInPath}>开始使用</a><a className="button button-ghost" href="#capabilities">查看功能</a></div>
        <div className="metric-row" id="capabilities"><div className="metric"><strong>01</strong><span>安全身份登录</span></div><div className="metric"><strong>02</strong><span>内容全生命周期</span></div><div className="metric"><strong>03</strong><span>细粒度角色权限</span></div></div>
      </main>
    </div>;
  }

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">墨</span>墨台</div><div className="nav-actions"><span className="badge badge-published">已安全登录</span><a className="button button-ghost button-small" href="/signout-with-chatgpt?return_to=/">退出</a></div></header>
    <div className="workspace">
      <aside className="sidebar">
        <div className="profile"><div className="avatar">{initialUser.displayName.slice(0, 1).toUpperCase()}</div><strong>{initialUser.displayName}</strong><span>{initialUser.email}</span></div>
        <nav className="side-nav" aria-label="工作台导航"><button className={`nav-button ${view === "content" ? "active" : ""}`} onClick={() => setView("content")}>内容工作台</button>{session?.role === "admin" && <button className={`nav-button ${view === "admin" ? "active" : ""}`} onClick={() => setView("admin")}>管理后台</button>}</nav>
      </aside>
      <main className={`main ${busy ? "loading" : ""}`}>
        {view === "content" ? <>
          <div className="page-head"><div><div className="eyebrow">Your publishing desk</div><h1>内容工作台</h1><p>管理草稿、发布内容，并保持团队表达一致。</p></div><button className="button button-primary" onClick={openCreate}>＋ 新建内容</button></div>
          <section className="stats" aria-label="内容概览"><div className="stat"><span>全部内容</span><strong>{stats.total}</strong></div><div className="stat"><span>已发布</span><strong>{stats.published}</strong></div><div className="stat"><span>草稿</span><strong>{stats.drafts}</strong></div></section>
          <section className="panel"><div className="panel-head"><h2>{session?.role === "admin" ? "全部团队内容" : "我的内容"}</h2><span className="eyebrow">{posts.length} items</span></div><div className="content-list">{posts.length === 0 ? <div className="empty">还没有内容，创建第一篇草稿吧。</div> : posts.map((post) => <article className="content-row" key={post.id}><div><h3><span className={`badge ${post.status === "published" ? "badge-published" : "badge-draft"}`}>{post.status === "published" ? "已发布" : "草稿"}</span>{post.title}</h3><p>{post.excerpt || "暂无摘要"} · {post.authorName} · {new Date(post.updatedAt).toLocaleDateString("zh-CN")}</p></div><div className="row-actions"><button className="button button-ghost button-small" onClick={() => openEdit(post)}>编辑</button><button className="button button-danger button-small" onClick={() => void deletePost(post.id)}>删除</button></div></article>)}</div></section>
        </> : <>
          <div className="page-head"><div><div className="eyebrow">Team governance</div><h1>管理后台</h1><p>查看成员并调整内容管理权限。</p></div></div>
          <section className="panel"><div className="panel-head"><h2>团队成员</h2><span className="eyebrow">{members.length} members</span></div><div className="content-list">{members.map((member) => <div className="content-row" key={member.email}><div><h3>{member.displayName} {member.role === "admin" && <span className="badge badge-admin">管理员</span>}</h3><p>{member.email} · 加入于 {new Date(member.createdAt).toLocaleDateString("zh-CN")}</p></div><div className="row-actions"><select aria-label={`设置 ${member.email} 的角色`} value={member.role} onChange={(event) => void changeRole(member.email, event.target.value as Role)} disabled={member.email === session?.email}><option value="editor">编辑者</option><option value="admin">管理员</option></select></div></div>)}</div></section>
        </>}
      </main>
    </div>
    {showEditor && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowEditor(false); }}><section className="modal" role="dialog" aria-modal="true" aria-label={editingId ? "编辑内容" : "新建内容"}><h2>{editingId ? "编辑内容" : "新建内容"}</h2><div className="form-grid"><div className="field"><label htmlFor="title">标题</label><input id="title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="输入清晰、有吸引力的标题" /></div><div className="field"><label htmlFor="excerpt">摘要</label><input id="excerpt" value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} placeholder="用一句话概括内容" /></div><div className="field"><label htmlFor="content">正文</label><textarea id="content" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="开始写作……" /></div><div className="field"><label htmlFor="status">状态</label><select id="status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as PostStatus })}><option value="draft">保存为草稿</option><option value="published">立即发布</option></select></div><div className="form-actions"><button className="button button-ghost" onClick={() => setShowEditor(false)}>取消</button><button className="button button-primary" onClick={() => void savePost()} disabled={busy}>{busy ? "保存中…" : "保存内容"}</button></div></div></section></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}
