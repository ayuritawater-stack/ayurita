import { Link } from "react-router-dom";
import { Droplets } from "lucide-react";

export default function NotFound() {
  return (
    <div className="py-24 text-center container-x">
      <Droplets className="w-12 h-12 text-brand-primary mx-auto mb-6" />
      <h1 className="font-heading font-bold text-4xl text-slate-900">Page not found</h1>
      <p className="text-slate-500 mt-3">The page you're looking for doesn't exist or may have moved.</p>
      <Link to="/" className="btn-primary mt-8 inline-flex">Back to Home</Link>
    </div>
  );
}
