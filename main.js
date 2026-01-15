
import { Buffer } from "https://cdn.jsdelivr.net/npm/buffer@6.0.3/+esm";
//Try 0.4.3 or 0.5.6 or 0.5.7 // https://unpkg.com/esptool-js/bundle.js
//import { ESPLoader, Transport } from "https://unpkg.com/esptool-js@0.5.7/bundle.js";
import SparkMD5 from "https://cdn.jsdelivr.net/npm/spark-md5-es@3.0.2/spark-md5.js";

// Polyfills needed by older esptool-js bundles
window.Buffer = Buffer;
window.global = window;

// Dynamically import esptool-js AFTER polyfills exis
import { ESPLoader, Transport } from "https://unpkg.com/esptool-js@0.4.3/bundle.js";

const btnConnect = document.getElementById("btnConnect");
const btnFlash   = document.getElementById("btnFlash");
const statusEl   = document.getElementById("status");
const logEl      = document.getElementById("log");
const binInput   = document.getElementById("binFile");
const chkErase   = document.getElementById("chkErase");
const baudSel    = document.getElementById("baud");

const statusDot = document.getElementById("statusDot");
const progressBar = document.getElementById("progressBar");
const progressPct = document.getElementById("progressPct");

let loader = null;

function setDot(state) {
  // state: "bad" | "warn" | "ok"
  statusDot.classList.remove("ok", "warn");
  if (state === "ok") statusDot.classList.add("ok");
  else if (state === "warn") statusDot.classList.add("warn");
  // default is red (bad)
}

function setProgress(pct) {
  const clamped = Math.max(0, Math.min(100, pct));
  progressBar.style.width = `${clamped}%`;
  progressPct.textContent = `${clamped.toFixed(1)}%`;
}


function log(msg) {
  logEl.textContent += msg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(msg) {
  statusEl.textContent = msg;
}


btnConnect.addEventListener("click", async () => {
  try {
    const port = await navigator.serial.requestPort();
    const transport = new Transport(port, true);

    const baudrate = Number(baudSel.value);
    loader = new ESPLoader({
      transport,
      baudrate,
      terminal: {
        clean: () => {},
        writeLine: (data) => log(String(data)),
        write: (data) => log(String(data)),
      },
    });

    setStatus("Connecting...");
    setDot("warn");
    setProgress(0);

    await loader.main();          // connect + sync + detect (typical usage)
    if (!loader.chip) {
      await loader.detectChip();  // fallback
    }

    const chipName = loader.chip?.CHIP_NAME ?? "Unknown";
    const chipDesc = loader.chip ? await loader.chip.getChipDescription(loader) : "Unknown";

    log(`Detected chip: ${chipName}`);
    log(`Chip description: ${chipDesc}`);

    if (!String(chipName).toLowerCase().includes("esp32-s3")) {
      loader = null;
      btnFlash.disabled = true;
      throw new Error(`ESP32-S3 only. Detected: ${chipName}`);
    }

    setStatus("Connected");
    btnFlash.disabled = false;

  } catch (err) {
    loader = null;
    btnFlash.disabled = true;
    setStatus("Not connected");
    log(`ERROR: ${err?.message || err}`);
  }
});


btnFlash.addEventListener("click", async () => {
  if (!loader) {
    log("Not connected.");
    return;
  }

  const file = binInput.files?.[0];
  if (!file) {
    log("Please choose a .bin file first.");
    return;
  }

  try {
    btnFlash.disabled = true;
    setStatus("Flashing...");

    if (chkErase.checked) {
      log("Erasing flash...");
      await loader.eraseFlash();
      log("Erase complete.");
    }

     // const binData = new Uint8Array(await file.arrayBuffer());
    const binBytes = new Uint8Array(await file.arrayBuffer());
    // Convert bytes -> "binary string" where each char code is one byte (0..255)
    const binData = new TextDecoder("latin1").decode(binBytes);
    
    log(`binData: ${binData.constructor.name}, length=${binData.length}`);

    log("Writing firmware (offset 0x0)...");
    await loader.writeFlash({
      fileArray: [{ data: binData, address: 0x0 }],
      flashSize: "keep",
      flashMode: "keep",
      flashFreq: "keep",
      compress: false,

        // Hash exactly the bytes in the Uint8Array
      calculateMD5Hash: (image) =>
        SparkMD5.ArrayBuffer.hash(
          image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength)
        ),
      
      reportProgress: (_i, written, total) => {
          const pct = (written / total) * 100;
          setProgress(pct);
          setStatus(`Flashing... ${pct.toFixed(1)}%`);
        },
    });

    log("Flash complete.");
    setProgress(100);
    setDot("ok");
    setStatus("Done");

  } catch (err) {
    log(`ERROR: ${err?.message || err}`);
    setStatus("Failed");
    setDot("bad");
    setProgress(0);
  } finally {
    btnFlash.disabled = false;
  }
});
