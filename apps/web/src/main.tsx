import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { configureNativeStatusBar } from "./lib/nativeStatusBar";
import "./index.css";

void configureNativeStatusBar();

createRoot(document.getElementById("root")!).render(<App />);
