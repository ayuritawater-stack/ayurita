import { MessageCircle } from "lucide-react";
import { useSettings } from "@/lib/settings";

export default function WhatsAppFloat() {
  const BUSINESS = useSettings();
  const url = `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(
    "Hello Ayurita, I'd like to enquire about your packaged drinking water supply.",
  )}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      data-testid="whatsapp-float"
      className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-[#25D366] shadow-[0_15px_40px_-10px_rgba(37,211,102,0.7)] flex items-center justify-center text-white hover:scale-110 transition-transform"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="w-6 h-6" strokeWidth={2} />
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30" />
    </a>
  );
}
