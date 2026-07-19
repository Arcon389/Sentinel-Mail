import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ConfirmProvider } from "./components/common/ConfirmDialog";
import "./i18n";
import "./styles/index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
