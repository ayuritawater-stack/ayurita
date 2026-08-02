import { useEffect, useRef, useState } from "react";
import { MapPin, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { mapsAvailable, mapsPlaceUrl } from "@/lib/googleMaps";
import MapPickerDialog from "@/components/MapPickerDialog";

const newSessionToken = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Address field with Google Places suggestions and a "Select on map" pin, shared by checkout and
// the account page's address book.
//
// `value` holds { address, city, state, pincode, lat, lng }; `onChange` receives a partial patch.
//
// Deliberate divergence from Kiran Traders: there, picking a suggestion is *mandatory* before an
// order can be placed. Here it is advisory. Ayurita's service area is enforced by the pincode
// allowlist server-side, and GOOGLE_MAPS_API_KEY may be unset - under kt's rule that combination
// would leave a customer unable to check out at all, because no suggestion would ever appear to
// pick. So `confirmed` drives a reassuring label, not a blocked submit button.
export default function AddressPicker({ value, onChange, confirmed, onConfirmedChange, testIdPrefix = "address" }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const sessionRef = useRef(newSessionToken());
  // Set when the address changes programmatically (suggestion picked, saved address applied) so
  // the change doesn't immediately trigger a fresh suggestions lookup for text we just wrote.
  const programmaticRef = useRef(false);

  const address = value.address || "";

  useEffect(() => {
    if (programmaticRef.current) { programmaticRef.current = false; return; }
    const q = address.trim();
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/places/autocomplete", { params: { q, session: sessionRef.current } });
        if (cancelled) return;
        setSuggestions(data.suggestions || []);
        setOpen((data.suggestions || []).length > 0);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [address]);

  const pick = async (s) => {
    setOpen(false);
    setSuggestions([]);
    programmaticRef.current = true;
    try {
      const { data } = await api.get(`/places/details/${s.place_id}`, { params: { session: sessionRef.current } });
      // A Places session ends at the first details call - start a fresh one for the next search.
      sessionRef.current = newSessionToken();
      onChange({
        address: data.address || s.description || s.main_text,
        city: data.city || value.city,
        state: data.state || value.state,
        pincode: /^\d{6}$/.test(data.pincode || "") ? data.pincode : value.pincode,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
      });
    } catch {
      onChange({ address: s.description || s.main_text });
    }
    onConfirmedChange(true);
  };

  const hasPin = value.lat != null && value.lng != null;

  return (
    <>
      <div className="relative">
        <Textarea
          required
          value={address}
          placeholder="Start typing to search your address"
          onChange={(e) => { onConfirmedChange(false); onChange({ address: e.target.value, lat: null, lng: null }); }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="mt-1.5 rounded-xl min-h-[80px]"
          data-testid={`${testIdPrefix}-input`}
        />
        {open && suggestions.length > 0 && (
          <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
            data-testid={`${testIdPrefix}-suggestions`}>
            {suggestions.map((s) => (
              <button key={s.place_id} type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-start gap-2 border-b border-slate-100 last:border-b-0">
                <MapPin className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900 truncate">{s.main_text}</span>
                  <span className="block text-xs text-slate-500 truncate">{s.secondary_text}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-1.5 flex items-center justify-between gap-2 flex-wrap">
          {confirmed
            ? <span className="text-xs text-brand-emerald inline-flex items-center gap-1"><Check className="h-3 w-3" /> Address confirmed</span>
            : <span className="text-xs text-slate-500">Pick from the suggestions or drop a pin for an exact location</span>}
          {mapsAvailable() && (
            <button type="button" onClick={() => setMapOpen(true)}
              className="text-xs text-brand-primary hover:underline inline-flex items-center gap-1"
              data-testid={`${testIdPrefix}-select-on-map`}>
              <MapPin className="h-3.5 w-3.5" /> {hasPin ? "Change location on map" : "Select on map"}
            </button>
          )}
        </div>

        {hasPin && (
          <div className="mt-1 text-[11px] text-slate-500">
            Pinned at {Number(value.lat).toFixed(5)}, {Number(value.lng).toFixed(5)} ·{" "}
            <a href={mapsPlaceUrl(value.lat, value.lng)} target="_blank" rel="noreferrer" className="text-brand-primary hover:underline">view</a>
          </div>
        )}
      </div>

      <MapPickerDialog
        open={mapOpen}
        onOpenChange={setMapOpen}
        initial={hasPin ? { lat: value.lat, lng: value.lng } : null}
        onConfirm={(pin, nearby) => {
          // A dropped pin is a deliberate confirmation of where to deliver, so it counts as
          // confirmation on its own - including when the customer skipped the suggestions.
          onChange({
            lat: pin.lat,
            lng: pin.lng,
            address: address.trim() || nearby || "",
          });
          onConfirmedChange(true);
        }}
      />
    </>
  );
}
