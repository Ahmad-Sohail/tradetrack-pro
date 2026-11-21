import ClientProfileView from "@/components/ClientProfileView";
export const metadata = { title: "Client profile" };
export default async function Page({ params }) { const { id } = await params; return <ClientProfileView id={id} />; }
