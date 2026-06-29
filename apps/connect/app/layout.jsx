import "./globals.css";
import { identityBrand } from "../src/config/brand.js";

export const metadata = {
  title: identityBrand.productName,
  description: "First-party identity and OIDC connection surface.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
