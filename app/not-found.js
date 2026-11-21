import Link from "next/link";
export const metadata = { title: "Page not found" };
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Page not found</h1>
      <p className="max-w-prose text-sm text-secondary">The page you are looking for does not exist or has moved.</p>
      <Link href="/" className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Go to your dashboard</Link>
    </main>
  );
}
