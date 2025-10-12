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

// Optional: API endpoint for latest order book
app.get("/api/orderbook", (req, res) => {
    res.json(tracker.orderBook);
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