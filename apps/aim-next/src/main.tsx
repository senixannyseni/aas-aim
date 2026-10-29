import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FutureAimApp from "./FutureAimApp";
import "./styles.css";
const rootElement = document.getElementById("root");
if (rootElement === null) throw new Error("AAS AIM Next: root element is missing.");
createRoot(rootElement).render(<StrictMode><FutureAimApp /></StrictMode>);
