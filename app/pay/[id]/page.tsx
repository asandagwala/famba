import { Suspense } from "react";
import PayClient from "./pay-client";

export default function PayPage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-[#685D55]">Loading payment…</p>}>
      <PayClient />
    </Suspense>
  );
}
