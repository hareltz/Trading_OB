// order_book.js
import WebSocket from "ws";
import fs from "fs";
import fetch from "node-fetch";

console.log("order book running...");

const symbol = "btcusdt";
const JSON_FILE = "order book/order_book.json";
const LOG_FILE = "order book/orderbook_log.txt";

let orderBook = { bids: {}, asks: {} };
let ws = null;

// ---- Get initial snapshot ----
async function main() {
    const url = `https://api.binance.com/api/v3/depth?symbol=${symbol.toUpperCase()}&limit=1000`;
    const snapshot = await fetch(url).then(res => res.json());

    for (const [price, qty] of snapshot.bids) {
        orderBook.bids[parseFloat(price)] = parseFloat(qty);
    }
    for (const [price, qty] of snapshot.asks) {
        orderBook.asks[parseFloat(price)] = parseFloat(qty);
    }

    console.log("Snapshot loaded.");
    logOrderBook();

    // Start WebSocket stream
    runDepthWS();
}

// ---- Logging ----
function logEvent(event) {
    const logLine = `[${new Date().toISOString()}] ${event}\n`;
    fs.appendFileSync(LOG_FILE, logLine);
}

function logOrderBook() {
    fs.writeFileSync(JSON_FILE, JSON.stringify(orderBook, null, 4));
    console.log(`The dictionary has been written to ${JSON_FILE}`);
}

// ---- Update book ----
function updateBook(side, updates) {
    for (const [price, qty] of updates) {
        const p = parseFloat(price);
        const q = parseFloat(qty);

        if (q === 0) {
            delete orderBook[side][p];
        } else {
            orderBook[side][p] = q;
        }
    }
}

// ---- WebSocket handling ----
function onMessage(message) {
    const data = JSON.parse(message.toString());
    updateBook("bids", data.b);
    updateBook("asks", data.a);
    logEvent(message);
}

function onError(error) {
    console.error("Error:", error);
}

function onClose() {
    console.log("Connection closed. Reconnecting in 3s...");
    setTimeout(runDepthWS, 3000);
}

function onOpen() {
    console.log("WebSocket connected.");
}

function runDepthWS() {
    const url = `wss://stream.binance.com:9443/ws/${symbol}@depth`;
    ws = new WebSocket(url);

    ws.on("open", onOpen);
    ws.on("message", onMessage);
    ws.on("error", onError);
    ws.on("close", onClose);
}

// ---- Start ----
main().catch(err => console.error("Initialization error:", err));
