import type { ReactNode } from "react";

export default function NewsroomLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
