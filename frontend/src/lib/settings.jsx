import { createContext, useContext, useEffect, useState } from "react";
import { api, BUSINESS as DEFAULT_BUSINESS } from "@/lib/api";

const SettingsContext = createContext(null);

const formatPhoneDisplay = (phone) => {
  const match = /^\+91(\d{5})(\d{5})$/.exec(phone || "");
  return match ? `+91 ${match[1]} ${match[2]}` : phone || DEFAULT_BUSINESS.phoneDisplay;
};

const INITIAL = { ...DEFAULT_BUSINESS, shippingFlat: 50, freeShippingAbove: 500 };

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(INITIAL);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/settings")
      .then(({ data }) => {
        if (cancelled || !data) return;
        setSettings({
          name: data.business_name || DEFAULT_BUSINESS.name,
          tagline: data.tagline || DEFAULT_BUSINESS.tagline,
          address: data.address || DEFAULT_BUSINESS.address,
          phone: data.phone || DEFAULT_BUSINESS.phone,
          phoneDisplay: formatPhoneDisplay(data.phone),
          whatsapp: data.whatsapp || DEFAULT_BUSINESS.whatsapp,
          email: data.email || DEFAULT_BUSINESS.email,
          hours: data.business_hours || DEFAULT_BUSINESS.hours,
          deliveryArea: DEFAULT_BUSINESS.deliveryArea,
          shippingFlat: Number.isFinite(data.shipping_flat) ? data.shipping_flat : 50,
          freeShippingAbove: Number.isFinite(data.free_shipping_above) ? data.free_shipping_above : 500,
          mapEmbed: data.address
            ? `https://www.google.com/maps?q=${encodeURIComponent(data.address)}&output=embed`
            : DEFAULT_BUSINESS.mapEmbed,
        });
      })
      .catch(() => {
        // Keep the hardcoded defaults on failure — public pages must still render.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext) || INITIAL;
