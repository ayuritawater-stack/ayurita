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

export const formatINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
