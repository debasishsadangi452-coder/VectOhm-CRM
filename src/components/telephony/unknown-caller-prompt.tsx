import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateContact } from "@/hooks/use-contacts";

// Shown after a call ends when the number on the call didn't match any
// existing Contact (§10, "Unknown Caller Handling") -- lets the rep save it
// as a new Contact in a couple of clicks instead of losing the lead. A
// self-contained mini-form rather than opening the shared ContactFormDialog:
// that dialog has no prefill contract, and all we need here is a name plus
// the number, which is already known.
export function UnknownCallerPrompt({ phone }: { phone: string }) {
  const createContact = useCreateContact();
  const [expanded, setExpanded] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saved, setSaved] = useState(false);

  if (saved) {
    return <p className="text-xs text-success">Saved as a new contact.</p>;
  }

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setExpanded(true)}
        className="w-full"
      >
        <UserPlus /> Save as contact
      </Button>
    );
  }

  async function handleSave() {
    if (!firstName.trim()) return;
    await createContact.mutateAsync({
      firstName: firstName.trim(),
      lastName: lastName.trim() || "Unknown",
      phone,
    });
    setSaved(true);
  }

  return (
    <div className="space-y-2 rounded-md border border-border-subtle p-2.5">
      <p className="text-[11px] text-text-dim">New contact · {phone}</p>
      <div className="flex gap-2">
        <Input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          className="h-8 text-xs"
        />
        <Input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
          className="h-8 text-xs"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(false)}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!firstName.trim() || createContact.isPending}
        >
          {createContact.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}
