import TradeForm from "@/components/TradeForm";
export const metadata = { title: "Add new trade" };
export default async function Page({ searchParams }) { const sp = await searchParams; return <TradeForm defaultClientId={typeof sp?.client === "string" ? sp.client : ""} />; }
