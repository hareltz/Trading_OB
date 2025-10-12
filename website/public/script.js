// public/script.js
const chartContainer = document.getElementById('chart-container');
const timeframeButtons = document.querySelectorAll('#timeframe-buttons button');
const log = document.getElementById('log');
const drawLineBtn = document.getElementById('draw-line-btn');

const wsBackend = new WebSocket(`ws://${window.location.host}`);
let currentInterval = '1m';
let ws;

// Create chart
const chart = LightweightCharts.createChart(chartContainer, {
    layout: {
        background: { color: '#000' },
        textColor: '#fff',
    },
    grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
    },
    crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
    },
    timeScale: {
        timeVisible: true,
        secondsVisible: false,
    },
});

const candlestickSeries = chart.addCandlestickSeries();

// Fetch historical data
async function fetchKlines(interval, limit = 2000) {
    const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.map(d => ({
        time: d[0] / 1000,
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
    }));
}

async function loadChart(interval) {
    if (ws) ws.close();
    currentInterval = interval;
    candlestickSeries.setData([]);
    
    const data = await fetchKlines(interval);
    candlestickSeries.setData(data);

    startWebSocket(interval);
    highlightActiveButton(interval);
    console.log(`Loaded ${interval} data`);
}

async function sendIntervalWS(interval) {
    if (wsBackend.readyState === WebSocket.OPEN) {
        wsBackend.send(JSON.stringify({ interval }));
    }
}

function startWebSocket(interval) {
    const stream = `wss://stream.binance.com:9443/ws/btcusdt@kline_${interval}`;
    ws = new WebSocket(stream);

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        const k = msg.k;
        if (k && !k.x) {
            candlestickSeries.update({
                time: k.t / 1000,
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
            });
        }
    };

    ws.onclose = () => {
        // try to open the websocket only if the
        // currentInterval in the interval of the function
        if (currentInterval == interval) 
        {
            console.log('WebSocket closed, reconnecting...');
            setTimeout(() => startWebSocket(interval), 2000);
        }
    };
}

// Draw example price line
drawLineBtn.addEventListener('click', () => {
    candlestickSeries.createPriceLine({
        price: 30000,
        color: '#ff0000',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Scripted Line',
    });

    drawLineBtn.disabled = true;
    drawLineBtn.textContent = 'Line Drawn!';
});

// Highlight active button
function highlightActiveButton(interval) {
    timeframeButtons.forEach(btn => {
        if (btn.dataset.interval === interval) {
            btn.style.backgroundColor = '#0056b3';
        } else {
            btn.style.backgroundColor = '#007bff';
        }
    });
}

// Button click events
timeframeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        loadChart(btn.dataset.interval);
        sendIntervalWS(btn.dataset.interval);
    });
});

// Initial load
loadChart(currentInterval);
