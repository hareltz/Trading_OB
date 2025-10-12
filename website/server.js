// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import OrderBookTracker from "./server/order_book.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // get the current path
const app = express(); // creating express application 

// Serve static files from /public
app.use(express.static(path.join(__dirname, "public")));

// Start the tracker
const tracker = new OrderBookTracker("btcusdt");
tracker.start();

// Optional: API endpoint for latest asksBlocks
app.get("/api/asksBlocks", (req, res) => {
    res.json(tracker.aBlocks);
});

// Optional: API endpoint for latest bidsBlocks
app.get("/api/bidsBlocks", (req, res) => {
    console.log("tracker.bBlocks type:", typeof tracker.bBlocks, tracker.bBlocks);
    res.json(tracker.bBlocks);
});

// Start server
const PORT = 3000;
const server = app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

const wss = new WebSocketServer({ server }); // attach to HTTP server
wss.on("connection", (ws) => {
    console.log("Frontend connected via WebSocket");

    ws.on("message", (msg) => {
        try {
            const data = JSON.parse(msg);
            if (data.interval) {
                tracker.currentInterval = data.interval;
                console.log("Updated interval via WebSocket:", data.interval);
            }
        } catch (err) {
            console.error("Failed to parse WebSocket message:", err);
        }
    });

    ws.on("close", () => {
        console.log("Frontend WebSocket disconnected");
    });
});