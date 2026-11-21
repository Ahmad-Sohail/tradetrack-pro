"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@neuctra/ui";
import { useAuth } from "@/app/contexts/AuthContext";

export default function HomeRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    router.replace(!user ? "/login" : user.role === "admin" ? "/dashboard" : "/portal");
  }, [user, loading, router]);
  return <div className="flex min-h-screen items-center justify-center bg-background"><Spinner size="lg" label="Loading" /></div>;
}
