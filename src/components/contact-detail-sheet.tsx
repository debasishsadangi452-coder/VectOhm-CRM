import { Activity, ArrowDownLeft, ArrowUpRight, Building2, Globe, Linkedin, Mail, MapPin, Pencil, Phone, StickyNote } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CallButton } from "@/components/telephony/call-button";
import { CallHistoryTable } from "@/components/telephony/call-history-table";
import { EngagementBadge } from "@/components/engagement-badge";
import { useSyncedEmails } from "@/hooks/use-synced-emails";
import { useEngagementEvents } from "@/hooks/use-engagement";
import type { Contact } from "@/lib/api/types";
import { getInitials } from "@/lib/utils";

interface ContactDetailSheetProps {
  contact: Contact | undefined;
  onOpenChange: (open: boolean) => void;
  onEdit: (contact: Contact) => void;
}

// Absolute LinkedIn/website values from an import are often bare domains
// ("linkedin.com/in/x", "example.com") rather than full URLs -- normalize so
// the link actually navigates instead of resolving relative to this app.
function toHref(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function PriorityBadge({ priority }: { priority: string }) {
  const normalized = priority.trim().toUpperCase();
  const style = normalized.startsWith("A")
    ? "bg-success/15 text-success border-success/20"
    : normalized.startsWith("B")
      ? "bg-primary/15 text-primary border-primary/20"
      : normalized.startsWith("C")
        ? "bg-amber-500/15 text-amber-500 border-amber-500/20"
        : "bg-canvas/50 text-text-dim border-border-subtle";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${style}`}>
      {priority}
    </span>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="size-4 text-text-dim shrink-0 mt-0.5" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-text-dim">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline break-words"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm break-words">{value}</p>
        )}
      </div>
    </div>
  );
}

export function ContactDetailSheet({ contact, onOpenChange, onEdit }: ContactDetailSheetProps) {
  // Rows actually rendered below: bulkEmailRecipients direct, but sequence
  // rows come from the nested sends array on each enrollment, not from the
  // enrollments themselves -- a contact can have an active enrollment with
  // zero sends so far. Gating visibility (and the "no details" fallback) on
  // enrollments.length alone let the section render with an empty body and
  // wrongly suppressed the real "no additional details" message.
  const sequenceSendCount =
    contact?.sequenceEnrollments?.reduce((sum, e) => sum + (e.sends?.length ?? 0), 0) ?? 0;
  const bulkRecipientCount = contact?.bulkEmailRecipients?.length ?? 0;
  const { data: syncedEmails } = useSyncedEmails({ contactId: contact?.id }, !!contact?.id);
  const { data: engagementEvents } = useEngagementEvents({ contactId: contact?.id }, !!contact?.id);
  const hasEmailHistory = bulkRecipientCount > 0 || sequenceSendCount > 0 || !!syncedEmails?.length;

  return (
    <Sheet open={!!contact} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {contact && (
          <>
            <SheetHeader>
              <div className="flex items-start gap-3 pr-6">
                <Avatar className="size-12 shrink-0">
                  <AvatarFallback className="text-sm">
                    {getInitials(contact)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-left truncate">
                    {contact.firstName} {contact.lastName}
                  </SheetTitle>
                  {contact.title && <p className="text-xs text-text-dim mt-0.5">{contact.title}</p>}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <EngagementBadge tier={contact.engagementTier} score={contact.engagementScore} />
                    {contact.priority && <PriorityBadge priority={contact.priority} />}
                    {contact.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-canvas/50 border-border-subtle text-text-dim">
                        {contact.category}
                      </span>
                    )}
                    {contact.source === "APOLLO" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20">
                        Apollo
                      </span>
                    )}
                    {contact.source === "IMPORT" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-canvas/50 text-text-dim border-border-subtle">
                        Imported
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-6 divide-y divide-border-subtle">
              {contact.email && (
                <DetailRow
                  icon={Mail}
                  label="Email"
                  value={contact.email}
                  href={`mailto:${contact.email}`}
                />
              )}
              {contact.phone && (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <DetailRow
                      icon={Phone}
                      label="Phone"
                      value={contact.phone}
                      href={`tel:${contact.phone}`}
                    />
                  </div>
                  <CallButton
                    toNumber={contact.phone}
                    displayName={`${contact.firstName} ${contact.lastName}`}
                    contactId={contact.id}
                    companyId={contact.company?.id}
                  />
                </div>
              )}
              {contact.linkedinUrl && (
                <DetailRow
                  icon={Linkedin}
                  label="LinkedIn"
                  value={contact.linkedinUrl}
                  href={toHref(contact.linkedinUrl)}
                />
              )}
              {contact.website && (
                <DetailRow
                  icon={Globe}
                  label="Website"
                  value={contact.website}
                  href={toHref(contact.website)}
                />
              )}
              {contact.company && (
                <DetailRow icon={Building2} label="Company" value={contact.company.name} />
              )}
              {contact.location && (
                <DetailRow icon={MapPin} label="Location" value={contact.location} />
              )}
              {contact.notes && <DetailRow icon={StickyNote} label="Notes" value={contact.notes} />}
            </div>

            {/* Call History */}
            <div className="mt-6 pt-4 border-t border-border-subtle">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">
                Call History
              </h3>
              <CallHistoryTable contactId={contact.id} compact />
            </div>

            {/* Email History */}
            {hasEmailHistory && (
              <div className="mt-6 pt-4 border-t border-border-subtle">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">
                  Email History
                </h3>
                <div className="space-y-2">
                  {contact.bulkEmailRecipients?.map((rec) => (
                    <div
                      key={rec.id}
                      className="text-xs flex items-start justify-between bg-canvas/30 p-2.5 rounded-lg border border-border-subtle"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-medium truncate">{rec.campaign?.name ?? "Bulk email"}</p>
                        <p className="text-[10px] text-text-dim mt-0.5">
                          Sent: {rec.sentAt ? new Date(rec.sentAt).toLocaleDateString() : "Pending"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {rec.status === "SENT" && rec.openCount && rec.openCount > 0 ? (
                          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success font-medium">
                            Opened {rec.openCount}x
                          </span>
                        ) : rec.status === "SENT" ? (
                          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-panel-elevated text-text-dim">
                            Delivered
                          </span>
                        ) : (
                          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                            {rec.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {contact.sequenceEnrollments?.map((enroll) =>
                    enroll.sends?.map((send) => (
                      <div
                        key={send.id}
                        className="text-xs flex items-start justify-between bg-canvas/30 p-2.5 rounded-lg border border-border-subtle"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-medium truncate">
                            Seq: {enroll.sequence?.name ?? "Sequence"}
                          </p>
                          <p className="text-[10px] text-text-dim mt-0.5">
                            Sent: {new Date(send.sentAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {send.status === "SENT" && send.openCount && send.openCount > 0 ? (
                            <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success font-medium">
                              Opened {send.openCount}x
                            </span>
                          ) : send.status === "SENT" ? (
                            <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-panel-elevated text-text-dim">
                              Delivered
                            </span>
                          ) : send.status === "PENDING" ? (
                            <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-panel-elevated text-text-dim">
                              Sending
                            </span>
                          ) : (
                            <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                              Failed
                            </span>
                          )}
                        </div>
                      </div>
                    )),
                  )}
                  {syncedEmails?.map((email) => (
                    <div
                      key={email.id}
                      className="text-xs flex items-start justify-between bg-canvas/30 p-2.5 rounded-lg border border-border-subtle"
                    >
                      <div className="min-w-0 flex-1 pr-2 flex items-start gap-1.5">
                        {email.direction === "SENT" ? (
                          <ArrowUpRight className="size-3 mt-0.5 text-primary shrink-0" />
                        ) : (
                          <ArrowDownLeft className="size-3 mt-0.5 text-cyan-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{email.subject || "(no subject)"}</p>
                          <p className="text-[10px] text-text-dim mt-0.5">
                            {new Date(email.occurredAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {engagementEvents && engagementEvents.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border-subtle">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3 flex items-center gap-1.5">
                  <Activity className="size-3.5 text-primary" />
                  Engagement Events
                </h3>
                <div className="space-y-2">
                  {engagementEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="text-xs flex items-center justify-between bg-canvas/30 p-2.5 rounded-lg border border-border-subtle"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-medium text-xs">{evt.type.replace(/_/g, " ")}</p>
                        <p className="text-[10px] text-text-dim mt-0.5">
                          {new Date(evt.occurredAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0 uppercase">
                        {evt.type.split("_")[0]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!contact.email &&
              !contact.phone &&
              !contact.linkedinUrl &&
              !contact.website &&
              !contact.company &&
              !contact.location &&
              !contact.notes &&
              !hasEmailHistory && (
                <p className="text-sm text-text-dim py-6 text-center">
                  No additional details on file for this contact.
                </p>
              )}

            <div className="mt-6 pt-4 border-t border-border-subtle flex justify-end">
              <Button size="sm" onClick={() => onEdit(contact)} className="gap-1.5">
                <Pencil className="size-3.5" />
                Edit
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
