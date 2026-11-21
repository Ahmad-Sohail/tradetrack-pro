import TradeForm from "@/components/TradeForm";
export const metadata = { title: "Edit trade" };
export default async function Page({ params }) { const { id } = await params; return <TradeForm tradeId={id} />; }
