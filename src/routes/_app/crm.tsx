import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as XLSX from "xlsx";
import { Download, List, Plus, Search, Upload, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/table-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyFormPagePanel } from "@/components/company-form-page-panel";
import { ContactFormPagePanel } from "@/components/contact-form-page-panel";
import { ContactDetailSheet } from "@/components/contact-detail-sheet";
import { ContactImportDialog } from "@/components/contact-import-dialog";
import { DealFormPagePanel } from "@/components/deal-form-page-panel";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { useCompanies } from "@/hooks/use-companies";
import { useContacts } from "@/hooks/use-contacts";
import { useDeals, useUpdateDeal } from "@/hooks/use-deals";
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  type Company,
  type Contact,
  type Deal,
  type DealStage,
  type LeadSource,
} from "@/lib/api/types";

type ContactSourceFilter = "ALL" | LeadSource;

const CONTACT_SOURCE_LABELS: Record<ContactSourceFilter, string> = {
  ALL: "All sources",
  MANUAL: "Manual",
  APOLLO: "Apollo",
  IMPORT: "Imported",
};

// Downloads whatever's currently in view as a .csv -- built specifically so
// the emails in it can be re-uploaded straight into Bulk Email's recipient
// file picker instead of hand-picking contacts one at a time there.
function exportContactsCsv(contacts: Contact[]) {
  const header = ["First Name", "Last Name", "Email", "Phone", "Title", "Company", "Priority", "Category", "Source"];
  const rows = contacts.map((c) => [
    c.firstName,
    c.lastName,
    c.email ?? "",
    c.phone ?? "",
    c.title ?? "",
    c.company?.name ?? "",
    c.priority ?? "",
    c.category ?? "",
    c.source,
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const csv = XLSX.utils.sheet_to_csv(sheet);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export const Route = createFileRoute("/_app/crm")({
  component: CrmPage,
});

const ALL = "__all__";

function CrmPage() {
  useDepartmentGuard("Sales");

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-start gap-4">
        <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
          <Users2 className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM & Sales</h1>
          <p className="text-sm text-text-dim mt-1">Pipeline, companies, and contacts for the sales team.</p>
        </div>
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="mt-4">
          <PipelineTab />
        </TabsContent>
        <TabsContent value="companies" className="mt-4">
          <CompaniesTab />
        </TabsContent>
        <TabsContent value="contacts" className="mt-4">
          <ContactsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const DEAL_STAGE_TONE: Record<DealStage, string> = {
  NEW_LEAD: "text-text-dim",
  QUALIFIED: "text-info",
  MEETING_SCHEDULED: "text-violet",
  PROPOSAL_SENT: "text-warning",
  NEGOTIATION: "text-warning",
  WON: "text-success",
  LOST: "text-destructive",
  ARCHIVED: "text-text-dim",
};

type Columns = Record<DealStage, Deal[]>;

function emptyColumns(): Columns {
  return {
    NEW_LEAD: [],
    QUALIFIED: [],
    MEETING_SCHEDULED: [],
    PROPOSAL_SENT: [],
    NEGOTIATION: [],
    WON: [],
    LOST: [],
    ARCHIVED: [],
  };
}

function groupByStage(deals: Deal[]): Columns {
  const columns = emptyColumns();
  for (const deal of deals) {
    columns[deal.stage].push(deal);
  }
  for (const stage of DEAL_STAGES) {
    columns[stage].sort((a, b) => a.position - b.position);
  }
  return columns;
}

function PipelineTab() {
  const { data: deals } = useDeals();
  const updateDeal = useUpdateDeal();

  const [columns, setColumns] = useState<Columns>(emptyColumns());
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [isCreatingDeal, setIsCreatingDeal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (deals) {
      setColumns(groupByStage(deals));
    }
  }, [deals]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function findColumnOf(dealId: string): DealStage | undefined {
    return DEAL_STAGES.find((s) => columns[s].some((d) => d.id === dealId));
  }

  function handleDragStart(event: DragStartEvent) {
    const dealId = String(event.active.id);
    const stage = findColumnOf(dealId);
    if (stage) {
      setActiveDeal(columns[stage].find((d) => d.id === dealId) ?? null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const sourceStage = findColumnOf(activeId);
    if (!sourceStage) return;

    const overId = String(over.id);
    const destStage = (DEAL_STAGES as string[]).includes(overId) ? (overId as DealStage) : findColumnOf(overId);
    if (!destStage) return;

    const sourceList = [...columns[sourceStage]];
    const dealIndex = sourceList.findIndex((d) => d.id === activeId);
    if (dealIndex === -1) return;
    const [moved] = sourceList.splice(dealIndex, 1);

    const destList = sourceStage === destStage ? sourceList : [...columns[destStage]];
    const overIndex = destList.findIndex((d) => d.id === overId);
    const insertAt = overIndex === -1 ? destList.length : overIndex;
    destList.splice(insertAt, 0, { ...moved, stage: destStage });

    setColumns((prev) => ({ ...prev, [sourceStage]: sourceList, [destStage]: destList }));
    updateDeal.mutate({ id: activeId, input: { stage: destStage, position: insertAt } });
  }

  function openCreate() {
    setIsCreatingDeal(true);
  }

  // Opening an existing deal goes to its own page rather than a dialog: the
  // activity log is a full table and never had room inside a modal.
  function openDeal(dealId: string) {
    navigate({ to: "/deals/$id", params: { id: dealId } });
  }

  if (isCreatingDeal) {
    return (
      <div className="pt-2">
        <DealFormPagePanel
          onBack={() => setIsCreatingDeal(false)}
          onCreated={() => setIsCreatingDeal(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" asChild>
          <Link to="/deals">
            <List className="size-4" />
            View all leads
          </Link>
        </Button>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          New Deal
        </Button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {DEAL_STAGES.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              deals={columns[stage]}
              onDealClick={openDeal}
            />
          ))}
        </div>
        <DragOverlay>{activeDeal && <DealCard deal={activeDeal} dragging />}</DragOverlay>
      </DndContext>
    </div>
  );
}

function PipelineColumn({
  stage,
  deals,
  onDealClick,
}: {
  stage: DealStage;
  deals: Deal[];
  onDealClick: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className="bg-panel border border-border-subtle rounded-xl p-3 flex flex-col gap-2 min-h-[220px]"
    >
      <div className="flex items-center justify-between px-1">
        <Link
          to="/deals"
          search={{ stage }}
          className={`text-xs font-semibold hover:underline ${DEAL_STAGE_TONE[stage]}`}
        >
          {DEAL_STAGE_LABELS[stage]}
        </Link>
        <span className="text-[10px] text-text-dim">{deals.length}</span>
      </div>
      <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 min-h-[80px]">
          {deals.map((deal) => (
            <SortableDealCard key={deal.id} deal={deal} onClick={() => onDealClick(deal.id)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableDealCard({ deal, onClick }: { deal: Deal; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick}>
      <DealCard deal={deal} />
    </div>
  );
}

function DealCard({ deal, dragging }: { deal: Deal; dragging?: boolean }) {
  return (
    <div
      className={`bg-canvas/50 border border-border-subtle rounded-lg p-3 cursor-pointer hover:border-border transition-colors ${dragging ? "shadow-xl" : ""}`}
    >
      <p className="text-sm font-medium truncate">{deal.title}</p>
      <p className="text-xs text-text-dim mt-0.5">${deal.value.toLocaleString()}</p>
      {deal.approvalStatus === "PENDING" && (
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning mt-1.5">
          Pending approval
        </span>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-text-dim truncate">{deal.company?.name ?? "—"}</span>
        <Avatar className="size-5 shrink-0">
          <AvatarFallback className="text-[9px]">
            {getInitials(deal.owner)}
          </AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}

// One search box shared by both tabs so they filter and look identical.
function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-dim" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}

function CompaniesTab() {
  const { data: allCompanies, isLoading } = useCompanies();
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | undefined>(undefined);
  const [query, setQuery] = useState("");

  // Name, domain, and industry -- the three columns actually on screen, so a
  // search that matches shows a row whose match is visible.
  const companies = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return allCompanies;
    return allCompanies?.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.domain ?? "").toLowerCase().includes(term) ||
        (c.industry ?? "").toLowerCase().includes(term),
    );
  }, [allCompanies, query]);

  const pager = usePagination(companies);

  function openCreate() {
    setEditingCompany(undefined);
    setIsCreatingCompany(true);
  }

  function openEdit(company: Company) {
    setEditingCompany(company);
    setIsCreatingCompany(false);
  }

  if (isCreatingCompany || editingCompany) {
    return (
      <div className="pt-2">
        <CompanyFormPagePanel
          company={editingCompany}
          onBack={() => {
            setEditingCompany(undefined);
            setIsCreatingCompany(false);
          }}
          onCreated={() => {
            setEditingCompany(undefined);
            setIsCreatingCompany(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search companies, domain, or industry…"
        />
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add Company
        </Button>
      </div>

      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Deals</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-8">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && companies?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-8">
                  {query ? "No companies match that search." : "No companies yet."}
                </TableCell>
              </TableRow>
            )}
            {pager.pageItems.map((company) => (
              <TableRow key={company.id} className="cursor-pointer" onClick={() => openEdit(company)}>
                <TableCell className="font-medium">{company.name}</TableCell>
                <TableCell className="text-text-dim">{company.domain ?? "—"}</TableCell>
                <TableCell className="text-text-dim">{company.industry ?? "—"}</TableCell>
                <TableCell className="text-text-dim">{company._count.contacts}</TableCell>
                <TableCell className="text-text-dim">{company._count.deals}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        pageSize={pager.pageSize}
        firstRow={pager.firstRow}
        lastRow={pager.lastRow}
        onPageChange={pager.setPage}
        onPageSizeChange={pager.setPageSize}
        noun="companies"
      />
    </div>
  );
}

function ContactsTab() {
  const [companyId, setCompanyId] = useState<string>(ALL);
  const [sourceFilter, setSourceFilter] = useState<ContactSourceFilter>("ALL");
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | undefined>(undefined);
  const [viewingContact, setViewingContact] = useState<Contact | undefined>(undefined);
  const [query, setQuery] = useState("");

  const { data: companies } = useCompanies();
  const { data: allContacts, isLoading } = useContacts({
    companyId: companyId === ALL ? undefined : companyId,
  });
  const contacts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return allContacts
      ?.filter((c) => (sourceFilter === "ALL" ? true : c.source === sourceFilter))
      .filter((c) =>
        term
          ? `${c.firstName} ${c.lastName}`.toLowerCase().includes(term) ||
            (c.email ?? "").toLowerCase().includes(term) ||
            (c.phone ?? "").toLowerCase().includes(term) ||
            (c.title ?? "").toLowerCase().includes(term) ||
            (c.company?.name ?? "").toLowerCase().includes(term)
          : true,
      );
  }, [allContacts, sourceFilter, query]);

  const pager = usePagination(contacts);

  function openCreate() {
    setEditingContact(undefined);
    setIsCreatingContact(true);
  }

  function openEdit(contact: Contact) {
    setViewingContact(undefined);
    setEditingContact(contact);
    setIsCreatingContact(false);
  }

  if (isCreatingContact || editingContact) {
    return (
      <div className="pt-2">
        <ContactFormPagePanel
          contact={editingContact}
          onBack={() => {
            setEditingContact(undefined);
            setIsCreatingContact(false);
          }}
          onCreated={() => {
            setEditingContact(undefined);
            setIsCreatingContact(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search name, email, phone, or company…"
          />
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All companies</SelectItem>
              {companies?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={(v: ContactSourceFilter) => setSourceFilter(v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CONTACT_SOURCE_LABELS) as ContactSourceFilter[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {CONTACT_SOURCE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => contacts && exportContactsCsv(contacts)}
            disabled={!contacts || contacts.length === 0}
            title="Download this filtered list as a CSV -- upload it in Bulk Email to add all these emails as recipients at once"
          >
            <Download className="size-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="size-4" />
            Import
          </Button>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add Contact
          </Button>
        </div>
      </div>

      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Priority</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-text-dim py-8">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && contacts?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-text-dim py-8">
                  No contacts match these filters.
                </TableCell>
              </TableRow>
            )}
            {pager.pageItems.map((contact) => (
              <TableRow key={contact.id} className="cursor-pointer" onClick={() => setViewingContact(contact)}>
                <TableCell className="font-medium">
                  {contact.firstName} {contact.lastName}
                </TableCell>
                <TableCell className="text-text-dim">{contact.email ?? "—"}</TableCell>
                <TableCell className="text-text-dim">{contact.phone ?? "—"}</TableCell>
                <TableCell className="text-text-dim">{contact.title ?? "—"}</TableCell>
                <TableCell className="text-text-dim">{contact.company?.name ?? "—"}</TableCell>
                <TableCell>
                  {contact.priority ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-canvas/50 border-border-subtle font-medium">
                      {contact.priority}
                    </span>
                  ) : (
                    <span className="text-text-dim">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        pageSize={pager.pageSize}
        firstRow={pager.firstRow}
        lastRow={pager.lastRow}
        onPageChange={pager.setPage}
        onPageSizeChange={pager.setPageSize}
        noun="contacts"
      />

      <ContactImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
      <ContactDetailSheet
        contact={viewingContact}
        onOpenChange={(open) => !open && setViewingContact(undefined)}
        onEdit={openEdit}
      />
    </div>
  );
}
