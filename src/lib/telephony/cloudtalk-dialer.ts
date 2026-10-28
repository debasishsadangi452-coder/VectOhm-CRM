// Helper for initiating outbound calls via CloudTalk CTI / Desktop App / Web Dialer
export function triggerCloudTalkCall(phoneNumber: string): boolean {
  try {
    const cleanNumber = phoneNumber.replace(/[^\d+]/g, "");
    if (!cleanNumber) return false;

    // Trigger CloudTalk protocol handler (launches CloudTalk Phone app or web client)
    const protocolUri = `cloudtalk://call?number=${encodeURIComponent(cleanNumber)}`;
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = protocolUri;
    document.body.appendChild(iframe);
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
    return true;
  } catch (err) {
    console.error("Failed to trigger CloudTalk protocol:", err);
    return false;
  }
}
