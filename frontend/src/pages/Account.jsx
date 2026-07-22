import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { User, MapPin, Mail, LockKeyhole, LogOut, Package, RotateCcw, Star, Pencil, Trash2, Plus, Wallet } from "lucide-react";
import { api, formatINR, logoutCustomer } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const statusColor = {
  placed: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  confirmed: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  processing: "bg-cyan-500/10 text-cyan-700 border-cyan-500/20",
  packed: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
  dispatched: "bg-purple-500/10 text-purple-700 border-purple-500/20",
  delivered: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  cancelled: "bg-red-500/10 text-red-700 border-red-500/20",
};

const emptyProfile = { business_name: "", contact_person: "", email: "", phone: "", address: "", city: "", gst_number: "" };

export default function Account() {
  const nav = useNavigate();
  const { addItem } = useCart();
  const { resetOnLogout } = useWishlist();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyProfile);
  const [savingProfile, setSavingProfile] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [reorderingId, setReorderingId] = useState(null);

  const [addresses, setAddresses] = useState([]);
  const [addressForm, setAddressForm] = useState(null);
  const [savingAddress, setSavingAddress] = useState(false);

  const [creditRequests, setCreditRequests] = useState([]);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [creditRequestAmount, setCreditRequestAmount] = useState("");
  const [creditRequestNote, setCreditRequestNote] = useState("");
  const [submittingCreditRequest, setSubmittingCreditRequest] = useState(false);

  useEffect(() => {
    api
      .get("/customer/profile")
      .then(({ data }) => {
        setProfile(data);
        setForm({ ...emptyProfile, ...data });
        setNewEmail(data.email || "");
      })
      .catch(() => toast.error("Unable to load profile"));
    api
      .get("/customer/orders")
      .then(({ data }) => setOrders(data))
      .finally(() => setLoadingOrders(false));
    api
      .get("/customer/addresses")
      .then(({ data }) => setAddresses(data))
      .catch(() => {});
    api
      .get("/customer/credit-request")
      .then(({ data }) => setCreditRequests(data))
      .catch(() => {});
  }, []);

  const submitCreditRequest = async (e) => {
    e.preventDefault();
    setSubmittingCreditRequest(true);
    try {
      const { data } = await api.post("/customer/credit-request", {
        requested_amount: Number(creditRequestAmount),
        note: creditRequestNote || null,
      });
      setCreditRequests((prev) => [data, ...prev]);
      setShowCreditForm(false);
      setCreditRequestAmount("");
      setCreditRequestNote("");
      toast.success("Credit request submitted — we'll be in touch shortly.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit request");
    } finally {
      setSubmittingCreditRequest(false);
    }
  };

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { business_name, contact_person, phone, address, city, gst_number } = form;
      const { data } = await api.put("/customer/profile", { business_name, contact_person, phone, address, city, gst_number });
      setProfile(data);
      localStorage.setItem("ayurita_customer_business_name", data.business_name);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Update failed");
    } finally {
      setSavingProfile(false);
    }
  };

  const saveEmail = async (e) => {
    e.preventDefault();
    setSavingEmail(true);
    try {
      const { data } = await api.put("/customer/profile", { email: newEmail.trim().toLowerCase() });
      setProfile(data);
      setForm((f) => ({ ...f, email: data.email }));
      localStorage.setItem("ayurita_customer_email", data.email);
      toast.success("Email updated");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Update failed");
    } finally {
      setSavingEmail(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.new_password.length < 6) return toast.error("New password must be at least 6 characters");
    if (pw.new_password !== pw.confirm) return toast.error("Passwords do not match");
    setSavingPw(true);
    try {
      const { data } = await api.post("/customer/profile/password", { current_password: pw.current_password, new_password: pw.new_password });
      if (data?.token) localStorage.setItem("ayurita_customer_token", data.token);
      toast.success("Password changed");
      setPw({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Change failed");
    } finally {
      setSavingPw(false);
    }
  };

  const logout = () => {
    logoutCustomer();
    resetOnLogout();
    nav("/");
  };

  const reorder = async (order, e) => {
    e.preventDefault();
    e.stopPropagation();
    setReorderingId(order.id);
    try {
      const results = await Promise.all(
        (order.items || []).map(async (item) => {
          try {
            const { data: product } = await api.get(`/products/${item.product_id}`);
            if (product.is_active) {
              addItem(product, item.quantity);
              return { ok: true };
            }
            return { ok: false, name: item.product_name };
          } catch {
            return { ok: false, name: item.product_name };
          }
        }),
      );
      const added = results.filter((r) => r.ok).length;
      const skipped = results.filter((r) => !r.ok).map((r) => r.name);
      if (added === 0) {
        toast.error("None of these items are available anymore");
        return;
      }
      toast.success(skipped.length ? `Added ${added} item(s) to cart. Unavailable: ${skipped.join(", ")}` : "Added to cart");
      nav("/cart");
    } finally {
      setReorderingId(null);
    }
  };

  const emptyAddressForm = { label: "", address: "", city: "", state: "", pincode: "", gst_number: "", is_default: false };

  const startAddAddress = () => setAddressForm({ ...emptyAddressForm });
  const startEditAddress = (a) => setAddressForm({ ...a });
  const cancelAddressForm = () => setAddressForm(null);
  const updAddress = (k, v) => setAddressForm((f) => ({ ...f, [k]: v }));

  const saveAddress = async (e) => {
    e.preventDefault();
    if (!addressForm.pincode || addressForm.pincode.length !== 6) return toast.error("Enter a valid 6-digit pincode");
    setSavingAddress(true);
    try {
      try {
        const { data: check } = await api.get(`/pincode/${addressForm.pincode}/verify`);
        if (check.valid === false) { toast.error("Enter a valid pincode — this pincode does not exist"); setSavingAddress(false); return; }
      } catch {
        // lookup unavailable - fail open, don't block saving the address
      }
      const { id, label, address, city, state, pincode, gst_number, is_default } = addressForm;
      const payload = { label, address, city, state, pincode, gst_number: gst_number || null, is_default };
      if (id) {
        const { data } = await api.put(`/customer/addresses/${id}`, payload);
        setAddresses((prev) => prev.map((a) => (a.id === id ? data : (data.is_default ? { ...a, is_default: false } : a))));
      } else {
        const { data } = await api.post("/customer/addresses", payload);
        setAddresses((prev) => [...(data.is_default ? prev.map((a) => ({ ...a, is_default: false })) : prev), data]);
      }
      toast.success("Address saved");
      setAddressForm(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save address");
    } finally {
      setSavingAddress(false);
    }
  };

  const deleteAddress = async (id) => {
    try {
      await api.delete(`/customer/addresses/${id}`);
      setAddresses((prev) => {
        const rest = prev.filter((a) => a.id !== id);
        if (rest.length && !rest.some((a) => a.is_default)) rest[0].is_default = true;
        return rest;
      });
      toast.success("Address removed");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to remove address");
    }
  };

  if (!profile) {
    return (
      <div className="py-12 md:py-16">
        <div className="container-x">
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 md:py-16">
      <div className="container-x space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading font-bold text-2xl md:text-3xl">My Account</h1>
            <p className="text-sm text-slate-500">
              {profile.business_name} · {profile.email}
            </p>
          </div>
          <button className="btn-secondary gap-2 inline-flex items-center" onClick={logout} data-testid="account-logout">
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <div className="space-y-4">
            <form onSubmit={saveProfile} className="card-premium p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <User className="h-4 w-4" />
                Business Details
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-slate-500">Business Name</Label>
                  <Input required value={form.business_name} onChange={(e) => upd("business_name", e.target.value)} data-testid="account-business-name-input" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Contact Person</Label>
                  <Input required value={form.contact_person} onChange={(e) => upd("contact_person", e.target.value)} data-testid="account-contact-person-input" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Phone Number</Label>
                  <Input required inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => upd("phone", e.target.value.replace(/[^0-9]/g, ""))} data-testid="account-phone-input" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">GST Number (optional)</Label>
                  <Input value={form.gst_number} onChange={(e) => upd("gst_number", e.target.value)} />
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm font-semibold pt-2">
                <MapPin className="h-4 w-4" />
                Default Delivery Address
              </div>
              <p className="text-xs text-slate-500 -mt-2">Used to pre-fill checkout. You can still edit it per order.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-500">Address</Label>
                  <Input value={form.address} onChange={(e) => upd("address", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">City</Label>
                  <Input value={form.city} onChange={(e) => upd("city", e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn-primary" disabled={savingProfile} data-testid="account-save-profile">
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>

            <div className="card-premium p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="h-4 w-4" />
                  Saved Addresses
                </div>
                {!addressForm && (
                  <button type="button" className="btn-secondary !py-1.5 !px-3 text-xs gap-1 inline-flex items-center" onClick={startAddAddress} data-testid="account-add-address">
                    <Plus className="h-3.5 w-3.5" /> Add Address
                  </button>
                )}
              </div>

              {addresses.length === 0 && !addressForm && (
                <p className="text-sm text-slate-500">No saved addresses yet. Add one to skip retyping it at checkout.</p>
              )}

              {addresses.length > 0 && (
                <div className="space-y-2">
                  {addresses.map((a) => (
                    <div key={a.id} className="rounded-xl border border-slate-200 p-3" data-testid={`account-address-${a.id}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          {a.label}
                          {a.is_default && (
                            <Badge variant="outline" className="!bg-sky-50 !text-brand-primary gap-1">
                              <Star className="h-3 w-3" /> Default
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" className="p-1.5 rounded-lg hover:bg-slate-100" onClick={() => startEditAddress(a)} data-testid={`account-edit-address-${a.id}`}>
                            <Pencil className="h-3.5 w-3.5 text-slate-500" />
                          </button>
                          <button type="button" className="p-1.5 rounded-lg hover:bg-slate-100" onClick={() => deleteAddress(a.id)} data-testid={`account-delete-address-${a.id}`}>
                            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {a.address}, {a.city}{a.state ? `, ${a.state}` : ""}{a.pincode ? ` - ${a.pincode}` : ""}
                        {a.gst_number && <> · GSTIN: {a.gst_number}</>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {addressForm && (
                <form onSubmit={saveAddress} className="rounded-xl border border-slate-200 p-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs text-slate-500">Label (e.g. Warehouse, Shop)</Label>
                      <Input required value={addressForm.label} onChange={(e) => updAddress("label", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">City</Label>
                      <Input required value={addressForm.city} onChange={(e) => updAddress("city", e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs text-slate-500">Address</Label>
                      <Input required value={addressForm.address} onChange={(e) => updAddress("address", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">State</Label>
                      <Input required value={addressForm.state || ""} onChange={(e) => updAddress("state", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Pincode</Label>
                      <Input required inputMode="numeric" maxLength={6} value={addressForm.pincode || ""} onChange={(e) => updAddress("pincode", e.target.value.replace(/[^0-9]/g, ""))} />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">GST Number (optional)</Label>
                      <Input value={addressForm.gst_number || ""} onChange={(e) => updAddress("gst_number", e.target.value)} />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input type="checkbox" checked={addressForm.is_default} onChange={(e) => updAddress("is_default", e.target.checked)} />
                        Set as default
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" className="btn-secondary" onClick={cancelAddressForm}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={savingAddress} data-testid="account-save-address">
                      {savingAddress ? "Saving..." : "Save Address"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <form onSubmit={saveEmail} className="card-premium p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Mail className="h-4 w-4" />
                Change Email
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
                <div>
                  <Label className="text-xs text-slate-500">New Email</Label>
                  <Input required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} data-testid="account-email-input" />
                </div>
                <button type="submit" className="btn-primary" disabled={savingEmail} data-testid="account-save-email">
                  {savingEmail ? "Updating..." : "Update Email"}
                </button>
              </div>
            </form>

            <form onSubmit={changePassword} className="card-premium p-5 space-y-4" autoComplete="off">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <LockKeyhole className="h-4 w-4" />
                Change Password
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs text-slate-500">Current Password</Label>
                  <PasswordInput required autoComplete="off" value={pw.current_password} onChange={(e) => setPw((p) => ({ ...p, current_password: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">New Password</Label>
                  <PasswordInput required autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw((p) => ({ ...p, new_password: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Confirm New Password</Label>
                  <PasswordInput required autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn-primary" disabled={savingPw} data-testid="account-save-password">
                  {savingPw ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-4">
          {(() => {
            const pendingRequest = creditRequests.find((r) => r.status === "pending");
            return (
              <div className="card-premium p-5 space-y-3" data-testid="account-credit-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Wallet className="h-4 w-4" />
                    Credit Account
                  </div>
                  {!pendingRequest && !showCreditForm && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand-primary hover:underline"
                      onClick={() => setShowCreditForm(true)}
                      data-testid="request-credit-btn"
                    >
                      {profile.credit_limit > 0 ? "Request Increase" : "Request Credit"}
                    </button>
                  )}
                </div>

                {profile.credit_limit > 0 ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Credit Limit</div>
                      <div className="font-semibold">{formatINR(profile.credit_limit)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Outstanding</div>
                      <div className="font-semibold">{formatINR(profile.credit_balance || 0)}</div>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-slate-100">
                      <div className="text-xs text-slate-500">Available Credit</div>
                      <div className="font-semibold text-brand-emerald">{formatINR(profile.credit_limit - (profile.credit_balance || 0))}</div>
                    </div>
                  </div>
                ) : !pendingRequest && !showCreditForm ? (
                  <p className="text-sm text-slate-500">No credit line yet — request one to bill orders instead of paying upfront.</p>
                ) : null}

                {pendingRequest && (
                  <div className="text-xs text-amber-600 font-medium" data-testid="pending-credit-request">
                    Request for {formatINR(pendingRequest.requested_amount)} pending review.
                  </div>
                )}

                {showCreditForm && (
                  <form onSubmit={submitCreditRequest} className="space-y-3 pt-2 border-t border-slate-100">
                    <div>
                      <Label className="text-xs text-slate-500">Requested Amount (₹)</Label>
                      <Input required type="number" min="1" value={creditRequestAmount} onChange={(e) => setCreditRequestAmount(e.target.value)} data-testid="credit-request-amount" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Note (optional)</Label>
                      <Input value={creditRequestNote} onChange={(e) => setCreditRequestNote(e.target.value)} placeholder="e.g. monthly order volume, business details" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" className="btn-secondary" onClick={() => setShowCreditForm(false)}>Cancel</button>
                      <button type="submit" className="btn-primary" disabled={submittingCreditRequest} data-testid="submit-credit-request">
                        {submittingCreditRequest ? "Submitting..." : "Submit Request"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })()}
          <div className="card-premium p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Package className="h-4 w-4" />
              Order History
            </div>
            {loadingOrders ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <p className="text-sm text-slate-500">No orders yet.</p>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                {orders.map((o) => (
                  <Link
                    key={o.id}
                    to={`/order-tracking/${o.order_number}`}
                    className="block rounded-xl border border-slate-200 p-3 hover:border-brand-primary/40 transition-colors"
                    data-testid={`account-order-${o.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono text-xs text-slate-500 truncate">{o.order_number}</div>
                      <Badge variant="outline" className={`shrink-0 ${statusColor[o.status] || ""}`}>
                        {o.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-xs text-slate-500">
                        {o.created_at?.slice(0, 10)} · {o.items?.length} item(s)
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-semibold">{formatINR(o.grand_total)}</div>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-primary hover:underline disabled:opacity-50"
                          onClick={(e) => reorder(o, e)}
                          disabled={reorderingId === o.id}
                          data-testid={`account-reorder-${o.id}`}
                        >
                          <RotateCcw className="h-3 w-3" />
                          {reorderingId === o.id ? "Adding..." : "Reorder"}
                        </button>
                      </div>
                    </div>
                    {o.payment_method === "credit" && o.credit_status !== "paid" && (
                      <div className="mt-1 text-xs text-amber-600 font-medium">
                        ₹{(o.grand_total - (o.amount_paid || 0)).toFixed(2)} due by {o.credit_due_date?.slice(0, 10)}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
