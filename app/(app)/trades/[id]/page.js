import TradeDetailView from "@/components/TradeDetailView";
export const metadata = { title: "Trade details" };
export default async function Page({ params }) { const { id } = await params; return <TradeDetailView id={id} />; }
