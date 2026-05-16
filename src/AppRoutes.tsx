import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppShell from "./components/AppShell";

export default function AppRoutes() {
  console.log("[APPROUTES_RENDER]");
  return <AppShell />;
}
