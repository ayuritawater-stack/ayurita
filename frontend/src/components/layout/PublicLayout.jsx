import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import WhatsAppFloat from "./WhatsAppFloat";
import CompareBar from "../CompareBar";

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-brand-bg">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <WhatsAppFloat />
      <CompareBar />
    </div>
  );
}
