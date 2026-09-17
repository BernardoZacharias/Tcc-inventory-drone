import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Preview from "./preview";
import { getTheme, setTheme } from "../src/utils/theme";

setTheme(getTheme());
createRoot(document.getElementById("root")).render(<StrictMode><Preview /></StrictMode>);
