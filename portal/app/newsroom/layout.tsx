import type { ReactNode } from "react";

import "@/styles/newsroom.css";

export default function NewsroomLayout({ children }: { children: ReactNode }) {
  return <div className="newsroom-layout min-h-screen">{children}</div>;
}
