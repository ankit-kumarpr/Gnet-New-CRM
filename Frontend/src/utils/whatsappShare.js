/** Prefer WhatsApp number, else phone. Returns digits for wa.me (with 91 if 10-digit IN). */
export function whatsappDigits(phoneOrWhatsapp) {
  const digits = String(phoneOrWhatsapp || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export function greetingWish() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function formatReportDate(value) {
  if (!value) return "today";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function clientReportCrmLink(reportId) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/dashboard/my-reports/${reportId}`;
}

/**
 * Proper WhatsApp message: greeting wish + report ready + CRM link.
 */
export function buildClientReportWhatsAppMessage({
  clientName,
  reportDate,
  reportUrl,
  companyName = "",
}) {
  const wish = greetingWish();
  const name = String(clientName || "Sir/Madam").trim() || "Sir/Madam";
  const brand = String(companyName || "").trim() || "GrandeurNet";
  const when = formatReportDate(reportDate);

  return (
    `${wish}, ${name}!\n\n` +
    `Greetings from ${brand}.\n\n` +
    `Your daily work report is ready (${when}).\n\n` +
    `Please open the link below to view your report in the CRM:\n` +
    `${reportUrl}\n\n` +
    `Thank you.\n` +
    `— ${brand}`
  );
}

export function openClientReportWhatsApp({
  phone,
  whatsapp,
  clientName,
  reportId,
  reportDate,
  companyName,
}) {
  const number = whatsappDigits(whatsapp || phone);
  if (!number) {
    const err = new Error("Client ka WhatsApp / phone number save nahi hai");
    err.code = "NO_PHONE";
    throw err;
  }
  const reportUrl = clientReportCrmLink(reportId);
  const text = buildClientReportWhatsAppMessage({
    clientName,
    reportDate,
    reportUrl,
    companyName,
  });
  const url = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
  return { number, reportUrl };
}
