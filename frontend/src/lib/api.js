import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ayurita_token");
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
