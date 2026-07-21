import "./globals.css";
import Shell from "./Shell";

export const metadata = {
  title: "Demand Command",
  description: "Demand planning command center",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
