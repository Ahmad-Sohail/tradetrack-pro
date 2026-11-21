import "./globals.css";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "@neuctra/ui";
import { AuthProvider } from "./contexts/AuthContext";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TradeTrack Pro: Trading client management dashboard",
    template: "%s | TradeTrack Pro",
  },
  description:
    "Manage clients, record every trade, and analyze profit and loss in one dashboard built for trading managers.",
};

// Dark is the default theme. Runs before hydration to avoid a flash.
const themeScript = `try{var t=localStorage.getItem("theme");document.documentElement.classList.toggle("dark",t?t==="dark":true)}catch(e){document.documentElement.classList.add("dark")}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
          <ToastProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
