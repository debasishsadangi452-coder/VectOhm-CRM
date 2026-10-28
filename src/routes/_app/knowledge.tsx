import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BookOpen, Search, Plus, Edit, Trash2, Loader2, User, Calendar, FileText, ChevronRight, Tag, Lock, HelpCircle } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useUsers } from "@/hooks/use-users";
import { useDepartments } from "@/hooks/use-departments";
import {
  useKBArticles,
  useKBArticle,
  useCreateKBArticle,
  useUpdateKBArticle,
  useDeleteKBArticle,
} from "@/hooks/use-knowledge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { KBArticle } from "@/lib/api/types";

export const Route = createFileRoute("/_app/knowledge")({
  component: KnowledgePage,
});

const CATEGORIES = ["SOP", "FAQ", "GUIDE", "STANDARD"] as const;

function KnowledgePage() {
  const currentUser = useAuthStore((s) => s.user);
  const { data: departments } = useDepartments();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);

  // Form dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KBArticle | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>("SOP");
  const [deptScopeId, setDeptScopeId] = useState<string>("public");

  // Fetch lists
  const { data: articles, isLoading } = useKBArticles(
    searchQuery || undefined,
    selectedCategory === "All" ? undefined : selectedCategory
  );

  const { data: activeArticle, isLoading: loadingDetail } = useKBArticle(activeArticleId || undefined);

  // Mutations
  const createArticle = useCreateKBArticle();
  const updateArticle = useUpdateKBArticle();
  const deleteArticle = useDeleteKBArticle();

  // Auto-select first article on load
  useEffect(() => {
    if (articles && articles.length > 0 && !activeArticleId) {
      setActiveArticleId(articles[0].id);
    }
  }, [articles, activeArticleId]);

  // Check if current user can edit/delete active article
  const canMutate = useMemo(() => {
    if (!activeArticle || !currentUser) return false;
    const isAdmin = currentUser.role.name === "ADMIN";
    const isAuthor = activeArticle.authorId === currentUser.id;
    const isDeptManager =
      currentUser.role.name === "MANAGER" &&
      (activeArticle.departmentId === null || activeArticle.departmentId === currentUser.department?.id);
    return isAdmin || isAuthor || isDeptManager;
  }, [activeArticle, currentUser]);

  // Open creation dialog
  const handleNewArticleClick = () => {
    setIsEdit(false);
    setEditingArticle(null);
    setTitle("");
    setContent("");
    setCategory("SOP");
    setDeptScopeId("public");
    setFormOpen(true);
  };

  // Open edit dialog
  const handleEditClick = () => {
    if (!activeArticle) return;
    setIsEdit(true);
    setEditingArticle(activeArticle);
    setTitle(activeArticle.title);
    setContent(activeArticle.content);
    setCategory(activeArticle.category ?? "SOP");
    setDeptScopeId(activeArticle.departmentId || "public");
    setFormOpen(true);
  };

  // Submit article creation/edit
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const input = {
      title: title.trim(),
      content: content.trim(),
      category,
      departmentId: deptScopeId === "public" ? null : deptScopeId,
    };

    try {
      if (isEdit && editingArticle) {
        await updateArticle.mutateAsync({ id: editingArticle.id, input });
      } else {
        const result = await createArticle.mutateAsync(input);
        setActiveArticleId(result.id);
      }
      setFormOpen(false);
    } catch (err) {
      console.error("Failed to save article", err);
    }
  };

  // Delete article
  const handleDeleteClick = async () => {
    if (!activeArticleId) return;
    if (confirm("Are you sure you want to delete this knowledge article?")) {
      try {
        await deleteArticle.mutateAsync(activeArticleId);
        setActiveArticleId(null);
      } catch (err) {
        console.error("Failed to delete article", err);
      }
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* LEFT SIDEBAR: Search, Category list, Articles list */}
      <div className="w-80 border-r border-border-subtle bg-panel flex flex-col shrink-0 select-none">
        {/* Header / Search */}
        <div className="p-4 border-b border-border-subtle space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="size-5 text-primary" />
              <span className="font-semibold text-sm tracking-tight">Wiki & SOPs</span>
            </div>
            <button
              onClick={handleNewArticleClick}
              className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="size-3.5" />
              New
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-text-dim" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search wiki articles..."
              className="pl-9 bg-background text-xs h-9"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="px-4 py-2 border-b border-border-subtle flex gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedCategory("All")}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
              selectedCategory === "All"
                ? "bg-primary text-primary-foreground"
                : "bg-panel-elevated text-text-dim hover:text-text"
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-panel-elevated text-text-dim hover:text-text"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Articles List */}
        <ScrollArea className="flex-1 px-3 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : articles && articles.length > 0 ? (
            <div className="space-y-1">
              {articles.map((art) => {
                const isActive = art.id === activeArticleId;
                return (
                  <button
                    key={art.id}
                    onClick={() => setActiveArticleId(art.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium flex flex-col gap-1 transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-text-dim hover:bg-panel-elevated hover:text-text"
                    }`}
                  >
                    <div className="flex items-start justify-between w-full gap-2">
                      <span className={`font-semibold truncate flex-1 ${isActive ? "text-primary-foreground" : "text-text"}`}>
                        {art.title}
                      </span>
                      <span className={`text-[8px] uppercase tracking-wider font-mono scale-90 px-1 py-0.5 rounded ${
                        isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-panel-elevated text-text-dim"
                      }`}>
                        {art.category}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-text-dim/80 w-full mt-0.5">
                      <span className={isActive ? "text-primary-foreground/75" : "text-text-dim"}>
                        {art.author.firstName} {art.author.lastName}
                      </span>
                      {art.department && (
                        <span className={`flex items-center gap-0.5 text-[8px] ${isActive ? "text-primary-foreground/75" : "text-primary font-medium"}`}>
                          <Lock className="size-2.5" />
                          {art.department.name}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-xs text-text-dim py-12">
              No knowledge articles found.
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ARTICLE READER (Right Pane) */}
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        {activeArticleId && loadingDetail ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="size-7 animate-spin text-primary" />
          </div>
        ) : activeArticle ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header info */}
            <div className="p-6 border-b border-border-subtle bg-panel flex items-start justify-between shrink-0 select-none">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-mono font-semibold uppercase">
                    {activeArticle.category}
                  </span>
                  {activeArticle.department && (
                    <span className="text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                      <Lock className="size-3" />
                      Locked to {activeArticle.department.name}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-text leading-tight">
                  {activeArticle.title}
                </h1>
                <div className="flex items-center gap-4 text-xs text-text-dim mt-2">
                  <div className="flex items-center gap-1.5">
                    <Avatar className="size-5 bg-primary/10 text-primary">
                      <AvatarFallback className="text-[9px] font-bold">
                        {getInitials(activeArticle.author)}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      Written by {activeArticle.author.firstName} {activeArticle.author.lastName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="size-3.5" />
                    <span>Last updated {new Date(activeArticle.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {canMutate && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={handleEditClick} className="text-text-dim hover:text-primary">
                    <Edit className="size-4 mr-1.5" />
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleDeleteClick} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="size-4 mr-1.5" />
                    Delete
                  </Button>
                </div>
              )}
            </div>

            {/* Content viewport */}
            <ScrollArea className="flex-1 p-8">
              <div className="max-w-[800px] mx-auto leading-relaxed text-sm text-text whitespace-pre-wrap font-sans space-y-4">
                {activeArticle.content}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
            <BookOpen className="size-14 text-primary/20 animate-pulse" />
            <h2 className="text-sm font-semibold text-text mt-4">Corporate Knowledge Base</h2>
            <p className="text-xs text-text-dim max-w-sm mt-1.5">
              Select a documentation page, guideline document, or SOP from the list, or create a new wiki article.
            </p>
          </div>
        )}
      </div>

      {/* DIALOG: Create / Edit Article */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl flex flex-col h-[85vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>{isEdit ? "Edit Wiki Article" : "Create Wiki Article"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
            <div className="space-y-1.5 shrink-0">
              <Label htmlFor="kb-title">Article Title</Label>
              <Input
                id="kb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Standard Dev Branching Protocols"
                required
                autoFocus
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 shrink-0">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Department Scope</Label>
                <Select value={deptScopeId} onValueChange={setDeptScopeId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public (All Departments)</SelectItem>
                    {currentUser?.role.name === "ADMIN"
                      ? departments?.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            Only {d.name} members
                          </SelectItem>
                        ))
                      : currentUser?.department && (
                          <SelectItem value={currentUser.department.id}>
                            Only {currentUser.department.name} members
                          </SelectItem>
                        )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex-1 flex flex-col space-y-1.5 min-h-0">
              <Label htmlFor="kb-content" className="shrink-0">Content Body</Label>
              <Textarea
                id="kb-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write documentation text here... Supports paragraphs and list styling."
                className="flex-1 resize-none bg-background text-xs"
                required
              />
            </div>

            <DialogFooter className="shrink-0">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createArticle.isPending || updateArticle.isPending}>
                {(createArticle.isPending || updateArticle.isPending) && (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                )}
                {isEdit ? "Save Changes" : "Publish Article"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
