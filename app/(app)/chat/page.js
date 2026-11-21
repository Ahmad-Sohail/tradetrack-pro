import { Suspense } from "react";
import ChatView from "@/components/ChatView";
export const metadata = { title: "Client chat" };
export default function Page() { return <Suspense fallback={null}><ChatView /></Suspense>; }
