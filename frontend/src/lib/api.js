import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
});

const parseJwt = (token) => {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(decoded)));
  } catch {
    return null;
  }
};

export const isTokenExpired = (token) => {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;
  const expires = typeof payload.exp === "number" ? payload.exp * 1000 : Date.parse(payload.exp);
  return Number.isNaN(expires) ? true : Date.now() >= expires;
};

export const logoutCustomer = () => {
  localStorage.removeItem("ayurita_customer_token");
  localStorage.removeItem("ayurita_customer_business_name");
  localStorage.removeItem("ayurita_customer_email");
};

export const isCustomerLoggedIn = () => {
  const token = localStorage.getItem("ayurita_customer_token");
  return !!token && !isTokenExpired(token);
};

api.interceptors.request.use((config) => {
  // Customer-owned endpoints (account area, and placing an order which now requires being
  // signed in) are authenticated with the customer's own token, never the admin token - kept
  // entirely separate even if both happen to be present in the same browser.
  const url = typeof config.url === "string" ? config.url : "";
  const isCustomerPath = url.startsWith("/customer/") || (url === "/orders" && (config.method || "get").toLowerCase() === "post");
  const token = localStorage.getItem(isCustomerPath ? "ayurita_customer_token" : "ayurita_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const BUSINESS = {
  name: "Ayurita Packaged Drinking Water",
  tagline: "Pure Water. Trusted Quality.",
  phone: "+919973251687",
  phoneDisplay: "+91 99732 51687",
  whatsapp: "919973251687",
  email: "hello@ayurita.com",
  address: "Naulakha Path, Bishanpur, Begusarai, Mohan Eghu, Bihar 851129",
  deliveryArea: "Delivery Available Across Begusarai District",
  hours: "Mon – Sat · 9:00 AM – 7:00 PM",
  mapEmbed: "https://www.google.com/maps?q=Bishanpur,Begusarai,Bihar+851129&output=embed",
};

// Fetches a file via the authenticated `api` instance (so admin-only exports carry the bearer
// token) and triggers a browser download - axios's own responseType:'blob' plus a synthetic
// <a> click, since a plain <a href> to the API URL wouldn't include the Authorization header.
// `config` optionally overrides method/data, e.g. { method: "post", data: {...} } for endpoints
// that need a request body (like a bulk ZIP export) rather than a plain GET.
export const downloadFile = async (url, params, filename, config = {}) => {
  const { method = "get", data: body } = config;
  const { data } = await api.request({ url, method, params, data: body, responseType: "blob" });
  const blobUrl = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
};

export const formatINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
