import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./router.tsx";

// Create a client
const queryClient = new QueryClient();

// Simple function to generate backing track
async function generateBackingTrack(prompt: string) {
    const response = await fetch("/generate-backing", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            prompt,
            tempo: 120, // default tempo
            style: "swing" // default style
        })
    });

    if (!response.ok) {
        throw new Error("Failed to generate backing track");
    }

    return response.blob(); // Returns audio blob
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    </StrictMode>
);
