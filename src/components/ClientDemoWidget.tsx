"use client";

import dynamic from "next/dynamic";

const DemoWidget = dynamic(() => import("./DemoWidget"), { ssr: false });

export default function ClientDemoWidget() {
  return <DemoWidget />;
}
