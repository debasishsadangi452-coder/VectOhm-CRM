import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { useCallStore, type CallTarget } from "@/stores/call-store";
import { canUseCalling } from "@/lib/telephony/access";
import { cn } from "@/lib/utils";

interface CallButtonProps {
  toNumber: string | null | undefined;
  displayName: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
  className?: string;
}

// Dropped wherever a phone number is shown -- Contact detail, Deal detail,
// list rows (see the plan's §14, "Click-to-Call Everywhere"). Renders
// nothing for a non-Sales/Admin user or a contact with no number on file.
export function CallButton({
  toNumber,
  displayName,
  contactId,
  companyId,
  dealId,
  variant = "outline",
  size = "sm",
  className,
}: CallButtonProps) {
  const user = useAuthStore((s) => s.user);
  const startCall = useCallStore((s) => s.startCall);

  if (!toNumber || !user || !canUseCalling(user)) return null;

  function handleClick() {
    const target: CallTarget = {
      toNumber: toNumber as string,
      displayName,
      contactId,
      companyId,
      dealId,
    };
    startCall(target);
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn(className)}
    >
      <Phone />
      {size !== "icon" ? "Call" : null}
    </Button>
  );
}
