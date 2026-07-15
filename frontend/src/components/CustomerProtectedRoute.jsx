import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { api, isTokenExpired, logoutCustomer } from "@/lib/api";

// Gates customer-only pages (checkout, account) behind sign-in. An unauthenticated visitor is
// sent to /signup - most visitors here are new, and the signup page itself links to sign in for
// existing customers. The attempted destination is preserved via location state so login/signup
// lands the customer back where they were headed, with the cart intact (cart lives in
// localStorage independent of auth).
export default function CustomerProtectedRoute() {
  const [status, setStatus] = useState("loading");
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("ayurita_customer_token");
    if (!token || isTokenExpired(token)) {
      if (token) logoutCustomer();
      setStatus("fail");
      return;
    }

    api
      .get("/customer/auth/me")
      .then(() => setStatus("ok"))
      .catch(() => {
        logoutCustomer();
        setStatus("fail");
      });
  }, [location.pathname]);

  if (status === "loading") {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="h-10 w-10 rounded-full border-4 border-brand-primary/30 border-t-brand-primary animate-spin" />
      </div>
    );
  }

  if (status === "fail") {
    return <Navigate to="/signup" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
