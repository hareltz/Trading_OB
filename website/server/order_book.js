// server/order_book.js
import WebSocket from "ws";
import fs from "fs";
import fetch from "node-fetch";

class OrderBookTracker {
    constructor(symbol, outputDir = "server/order_book") {
        this.symbol = symbol.toLowerCase();
        this.outputDir = outputDir;
        this.jsonFile = `${outputDir}/${this.symbol}.json`;
        this.logFile = `${outputDir}/${this.symbol}_log.txt`;
        this.orderBook = { bids: {}, asks: {} };
        this.currentInterval = "1m";
        this.bBlocks = [];
        this.aBlocks = [];
        this.ws = null;

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log(`Order book tracker for ${this.symbol.toUpperCase()} initialized.`);
    }

    async start() {
        try {
            await this.loadSnapshot();
            this.logOrderBook();
            this.runDepthWS();
        } catch (err) {
            console.error("Initialization error:", err);
        }
    }

    groupStrongLevels(side, threshold = 0.001) {
        // Convert object to array of {price, qty}
        const levels = Object.entries(this.orderBook[side]).map(([price, qty]) => ({
            price: Number(price),
            qty: qty
        }));

        // Sort ascending
        levels.sort((a, b) => a.price - b.price);

        const boxes = [];
        let currentBox = null;

        for (const level of levels) {
            if (level.qty < threshold) {
                // Skip weak levels
                if (currentBox) {
                    boxes.push(currentBox);
                    currentBox = null;
                }
                continue;
            }

            if (!currentBox) {
                // Start new box
                currentBox = { startPrice: level.price, endPrice: level.price, volume: level.qty };
            } else {
                currentBox.endPrice = level.price;
                currentBox.volume += level.qty;
            }
        }

        // Push the last box
        if (currentBox) boxes.push(currentBox);

        return boxes;
    }

    async loadSnapshot() {
        const url = `https://api.binance.com/api/v3/depth?symbol=${this.symbol.toUpperCase()}&limit=1000`;
        const snapshot = await fetch(url).then(res => res.json());

        for (const [price, qty] of snapshot.bids) {
            this.orderBook.bids[parseFloat(price)] = parseFloat(qty);
        }
        for (const [price, qty] of snapshot.asks) {
            this.orderBook.asks[parseFloat(price)] = parseFloat(qty);
        }

        console.log("Snapshot loaded.");
        this.logEvent("Snapshot loaded successfully.");
    }

    logEvent(event) {
        const logLine = `[${new Date().toISOString()}] ${event}\n`;
        fs.appendFileSync(this.logFile, logLine);
    }

    logOrderBook() {
        fs.writeFileSync(this.jsonFile, JSON.stringify(this.orderBook, null, 4));
        console.log(`Order book saved to ${this.jsonFile}`);
    }

    updateBook(side, updates) {
        for (const [price, qty] of updates) {
            const p = parseFloat(price);
            const q = parseFloat(qty);
            if (q === 0) delete this.orderBook[side][p];
            else this.orderBook[side][p] = q;
        }
    }

    onMessage(message) {
        try {
            const data = JSON.parse(message.toString());
            this.updateBook("bids", data.b);
            this.updateBook("asks", data.a);
            this.logEvent(message);

            this.bBlocks = this.groupStrongLevels("bids");
            this.aBlocks = this.groupStrongLevels("asks");

            // console.log("\n\n\nb blocks: \n\n\n")
            // console.log(this.bBlocks);

            // console.log("\n\n\na blocks: \n\n\n")
            // console.log(this.aBlocks);
        } catch (err) {
            console.error("Failed to process message:", err);
        }
    }

    onError(error) {
        console.error("WebSocket error:", error);
        this.logEvent(`WebSocket error: ${error.message}`);
    }

    onClose() {
        console.log("WebSocket closed. Reconnecting in 3s...");
        this.logEvent("WebSocket connection closed. Attempting reconnect...");
        setTimeout(() => this.runDepthWS(), 3000);
    }

    onOpen() {
        console.log("WebSocket connected.");
        this.logEvent("WebSocket connected successfully.");
    }

    runDepthWS() {
        const url = `wss://stream.binance.com:9443/ws/${this.symbol}@depth`;
        this.ws = new WebSocket(url);

        this.ws.on("open", () => this.onOpen());
        this.ws.on("message", (msg) => this.onMessage(msg));
        this.ws.on("error", (err) => this.onError(err));
        this.ws.on("close", () => this.onClose());
    }
}

// Start the tracker
// const tracker = new OrderBookTracker("btcusdt");
// tracker.start();

export default OrderBookTracker;