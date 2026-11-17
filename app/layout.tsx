import type { Metadata, Viewport } from "next";
import "@fontsource/noto-serif-kr/400.css";
import "@fontsource/noto-serif-kr/500.css";
import "@fontsource/ibm-plex-sans-kr/400.css";
import "@fontsource/ibm-plex-sans-kr/500.css";
import "@fontsource/ibm-plex-sans-kr/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "청라 레이크포레 — 사업계획서",
  description: "청라 레이크포레 공동주택 신축사업 사업계획서. 공공데이터로 분양 가정을 매일 갱신합니다. (교육용 합성 데이터)",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0E1A2E", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
