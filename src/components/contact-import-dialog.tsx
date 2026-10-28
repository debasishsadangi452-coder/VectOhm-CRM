import { useMemo, useState, type ChangeEvent } from "react";
import * as XLSX from "xlsx";
import { CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useImportContacts } from "@/hooks/use-contacts";
import type { ImportContactRow } from "@/lib/api/contacts";

interface ContactImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ContactField =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "title"
  | "companyName"
  | "linkedinUrl"
  | "location"
  | "website"
  | "category"
  | "priority"
  | "notes";
type ColumnMapping = ContactField | "ignore";

const FIELD_LABELS: Record<ContactField, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  title: "Title",
  companyName: "Company",
  linkedinUrl: "LinkedIn URL",
  location: "Location",
  website: "Website",
  category: "Category",
  priority: "Priority",
  notes: "Notes",
};

// Used to guess a sensible default mapping from common header names -- the
// user can always override any of these, this is just a head start so a
// well-formed export (like the one this feature was first built against)
// doesn't require mapping every column by hand. Order matters: earlier
// entries are checked first, so more specific aliases (e.g. "linkedin url")
// are declared before generic ones (e.g. "website") that could otherwise
// false-match a substring of them.
const FIELD_ALIASES: Record<ContactField, string[]> = {
  firstName: ["first name", "firstname", "first"],
  lastName: ["last name", "lastname", "last", "surname"],
  email: ["email", "email address"],
  phone: ["phone", "phone number", "mobile", "cell"],
  title: ["title", "headline", "job title", "position", "role"],
  companyName: ["company", "company name", "organization", "organisation", "employer"],
  linkedinUrl: ["linkedin", "linkedin url", "linkedin profile"],
  location: ["location", "city", "region", "address"],
  website: ["website", "web site", "company website", "homepage"],
  category: ["category", "categories", "segment", "tag", "tags"],
  priority: ["priority", "priority tier", "tier", "rank", "rating"],
  notes: ["notes", "note", "follow up notes", "follow up", "comments", "comment"],
};

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function guessMapping(header: string): ColumnMapping {
  const normalized = normalizeHeader(header);
  if (!normalized) return "ignore";
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [ContactField, string[]][]) {
    if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
      return field;
    }
  }
  return "ignore";
}

interface ParsedSheet {
  fileName: string;
  allRows: string[][];
  headerRowIndex: number;
}

export function ContactImportDialog({ open, onOpenChange }: ContactImportDialogProps) {
  const importContacts = useImportContacts();
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<number, ColumnMapping>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);

  const headers = parsed?.allRows[parsed.headerRowIndex] ?? [];
  const dataRows = useMemo(() => {
    if (!parsed) return [];
    return parsed.allRows.slice(parsed.headerRowIndex + 1).filter((row) => row.some((cell) => cell?.trim()));
  }, [parsed]);

  function reset() {
    setParsed(null);
    setMapping({});
    setParseError(null);
    setResult(null);
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setParseError(null);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const allRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
      if (allRows.length === 0) {
        setParseError("That file doesn't have any rows.");
        return;
      }

      // Guess which row is the real header: some exports (e.g. LinkedIn's)
      // put a merged title in row 1 -- pick whichever of the first 5 rows
      // has the most filled-in cells, which is reliably the header row.
      let headerRowIndex = 0;
      let bestFilledCount = -1;
      for (let i = 0; i < Math.min(5, allRows.length); i++) {
        const filled = allRows[i].filter((cell) => cell?.trim()).length;
        if (filled > bestFilledCount) {
          bestFilledCount = filled;
          headerRowIndex = i;
        }
      }

      const headerRow = allRows[headerRowIndex].map((h) => String(h ?? "").trim());
      const initialMapping: Record<number, ColumnMapping> = {};
      headerRow.forEach((h, i) => {
        initialMapping[i] = guessMapping(h);
      });

      setParsed({ fileName: file.name, allRows, headerRowIndex });
      setMapping(initialMapping);
    } catch {
      setParseError("Couldn't read that file -- make sure it's a valid .xlsx, .xls, .xlsm, or .csv file.");
    }
  }

  function buildRows(rows: string[][]): ImportContactRow[] {
    return rows.map((row) => {
      const byField: Partial<Record<ContactField, string[]>> = {};
      headers.forEach((_, colIndex) => {
        const field = mapping[colIndex];
        const value = row[colIndex]?.trim();
        if (!field || field === "ignore" || !value) return;
        (byField[field] ??= []).push(value);
      });
      const out: ImportContactRow = {};
      for (const field of Object.keys(byField) as ContactField[]) {
        out[field] = byField[field]!.join("; ");
      }
      return out;
    });
  }

  const previewRows = useMemo(() => buildRows(dataRows.slice(0, 5)), [dataRows, mapping, headers]);

  async function handleImport() {
    if (!parsed) return;
    const rows = buildRows(dataRows);
    const batch = await importContacts.mutateAsync({ fileName: parsed.fileName, rows });
    setResult({ created: batch.createdCount, updated: batch.updatedCount, skipped: batch.skippedCount });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import contacts from a spreadsheet</DialogTitle>
        </DialogHeader>

        {!parsed && (
          <div className="space-y-3">
            <p className="text-sm text-text-dim">
              Upload an .xlsx, .xls, .xlsm, or .csv file. You'll map its columns to contact
              fields before anything is imported.
            </p>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border-subtle rounded-xl py-10 cursor-pointer hover:border-primary/40 hover:bg-canvas/30 transition-colors">
              <UploadCloud className="size-6 text-text-dim" />
              <span className="text-sm text-text-dim">Click to choose a file</span>
              <Input
                type="file"
                // Extensions AND mime types together -- some OS file pickers
                // filter on one, some on the other, so listing both is the
                // only way to reliably not hide a real spreadsheet (e.g. a
                // macro-enabled .xlsm export) just because its exact
                // extension wasn't spelled out.
                accept=".xlsx,.xls,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.ms-excel.sheet.macroEnabled.12,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {parseError && <p className="text-sm text-destructive">{parseError}</p>}
          </div>
        )}

        {parsed && !result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="size-4 text-text-dim" />
              <span className="font-medium">{parsed.fileName}</span>
              <span className="text-text-dim">
                — {dataRows.length} row{dataRows.length !== 1 ? "s" : ""} detected
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold text-text-dim mb-2">
                Map each column (unmapped columns are ignored)
              </p>
              <ScrollArea className="h-56 border border-border-subtle rounded-lg">
                <div className="p-1.5 space-y-1">
                  {headers.map((header, colIndex) => (
                    <div
                      key={colIndex}
                      className="flex items-center gap-2 px-2 py-1.5 rounded bg-canvas/30 border border-border-subtle"
                    >
                      <span className="flex-1 text-xs truncate" title={header}>
                        {header || `Column ${colIndex + 1}`}
                      </span>
                      <Select
                        value={mapping[colIndex] ?? "ignore"}
                        onValueChange={(value: ColumnMapping) =>
                          setMapping((prev) => ({ ...prev, [colIndex]: value }))
                        }
                      >
                        <SelectTrigger className="w-40 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ignore">Ignore</SelectItem>
                          {(Object.keys(FIELD_LABELS) as ContactField[]).map((field) => (
                            <SelectItem key={field} value={field}>
                              {FIELD_LABELS[field]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {previewRows.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-dim mb-2">
                  Preview (first {previewRows.length})
                </p>
                <div className="border border-border-subtle rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Priority</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">
                            {[row.firstName, row.lastName].filter(Boolean).join(" ") || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-text-dim">{row.email ?? "—"}</TableCell>
                          <TableCell className="text-xs text-text-dim">{row.companyName ?? "—"}</TableCell>
                          <TableCell className="text-xs text-text-dim">{row.title ?? "—"}</TableCell>
                          <TableCell className="text-xs text-text-dim">{row.priority ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
              <Button variant="outline" size="sm" onClick={reset}>
                Choose a different file
              </Button>
              <Button
                onClick={handleImport}
                disabled={dataRows.length === 0 || importContacts.isPending}
                className="gap-1.5"
              >
                {importContacts.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UploadCloud className="size-4" />
                )}
                Import {dataRows.length} row{dataRows.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-success text-sm">
              <CheckCircle2 className="size-4" /> Import complete.
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-border-subtle p-3">
                <p className="text-lg font-semibold">{result.created}</p>
                <p className="text-[10px] text-text-dim">Created</p>
              </div>
              <div className="rounded-lg border border-border-subtle p-3">
                <p className="text-lg font-semibold">{result.updated}</p>
                <p className="text-[10px] text-text-dim">Updated</p>
              </div>
              <div className="rounded-lg border border-border-subtle p-3">
                <p className="text-lg font-semibold">{result.skipped}</p>
                <p className="text-[10px] text-text-dim">Skipped</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                Import another file
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
