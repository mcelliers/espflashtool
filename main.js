export const APP_VERSION = "1.0.3";
console.info(`ESPFlashTool version ${APP_VERSION}`);
import { ESPLoader, Transport } from "esptool-js";

const btnConnect = document.getElementById("btnConnect");
const btnFlash   = document.getElementById("btnFlash");
const btnDisconnect = document.getElementById("btnDisconnect");
const btnReset = document.getElementById("btnReset");
const statusEl   = document.getElementById("status");
const logEl      = document.getElementById("log");
const binInput   = document.getElementById("binFile");
const chkErase   = document.getElementById("chkErase");
const baudSel    = document.getElementById("baud");

const statusDot   = document.getElementById("statusDot");
const progressBar = document.getElementById("progressBar");
const progressPct = document.getElementById("progressPct");

let loader = null;
let transport = null;

function log(msg) {
  logEl.textContent += msg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}
function setStatus(msg) { statusEl.textContent = msg; }

function setDot(state) {
  statusDot.classList.remove("ok", "warn");
  if (state === "ok") statusDot.classList.add("ok");
  else if (state === "warn") statusDot.classList.add("warn");
  // default: red
}
function setProgress(pct) {
  const c = Math.max(0, Math.min(100, pct));
  progressBar.style.width = `${c}%`;
  progressPct.textContent = `${c.toFixed(1)}%`;
}

async function safeDisconnect() {
  try {
    if (transport) {
      // Close the serial port cleanly
      await transport.disconnect();
    } else if (loader?.transport) {
      // Fallback: some versions expose it here
      await loader.transport.disconnect();
    }
  } catch (e) {
    // Ignore disconnect errors; we want UI to recover regardless
    log(`Disconnect warning: ${e?.message || e}`);
  } finally {
    loader = null;
    transport = null;

    btnFlash.disabled = true;
    btnDisconnect.disabled = true;
    btnReset.disabled = true;

    setDot("bad");
    setProgress(0);
    setStatus("Not connected");
    log("Disconnected.");
  }
}

btnConnect.addEventListener("click", async () => {
  btnConnect.disabled = true;
  try {
    setDot("warn");
    setProgress(0);
    setStatus("Select COM port...");

    const port = await navigator.serial.requestPort();
    transport = new Transport(port, true);

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
    await loader.main();

    if (!loader.chip) await loader.detectChip();
    const chipName = loader.chip?.CHIP_NAME ?? "Unknown";
    const chipDesc = loader.chip ? await loader.chip.getChipDescription(loader) : "Unknown";

    log(`Detected chip: ${chipName}`);
    log(`Chip description: ${chipDesc}`);

    if (!String(chipName).toLowerCase().includes("esp32-s3")) {
      loader = null;
      btnFlash.disabled = true;
      setDot("bad");
      throw new Error(`ESP32-S3 only. Detected: ${chipName}`);
    }

    setDot("ok");
    setStatus("Connected");
    btnDisconnect.disabled = false;
    btnReset.disabled = false;
    btnFlash.disabled = false;
  } catch (err) {
    loader = null;
    btnFlash.disabled = true;
    setDot("bad");
    setStatus("Not connected");
    btnDisconnect.disabled = true;
    btnReset.disabled = true;
    log(`ERROR: ${err?.message || err}`);
  } finally {
    btnConnect.disabled = false;
  }
});

btnDisconnect.addEventListener("click", async () => {
  btnDisconnect.disabled = true;
  btnReset.disabled = true;
  btnFlash.disabled = true;
  await safeDisconnect();
});

btnFlash.addEventListener("click", async () => {
  if (!loader) { log("Not connected."); return; }

  const file = binInput.files?.[0];
  if (!file) { log("Please choose a .bin file first."); return; }

  btnFlash.disabled = true;
  btnConnect.disabled = true;
  btnReset.disabled = true;

  try {
    setDot("warn");
    setProgress(0);
    setStatus("Flashing...");

    if (chkErase.checked) {
      log("Erasing flash...");
      await loader.eraseFlash();
      log("Erase complete.");
    }

    const binData = new Uint8Array(await file.arrayBuffer());
    log(`Firmware loaded: ${binData.length} bytes`);

    log("Writing firmware (offset 0x0)...");
    await loader.writeFlash({
      fileArray: [{ data: binData, address: 0x0 }],
      flashSize: "keep",
      flashMode: "keep",
      flashFreq: "keep",
      compress: true,     // start with true (fast, widely used)
      eraseAll: false,
      reportProgress: (_i, written, total) => {
        const pct = (written / total) * 100;
        setProgress(pct);
        setStatus(`Flashing... ${pct.toFixed(1)}%`);
      },
    });

    setProgress(100);
    setDot("ok");
    setStatus("Done");
    log("Flash complete.");
  } catch (err) {
    setDot("bad");
    setStatus("Failed");
    log(`ERROR: ${err?.message || err}`);
  } finally {
    btnFlash.disabled = false;
    btnConnect.disabled = false;
    btnReset.disabled = false;
  }
});

btnReset.addEventListener("click", async () => {
  if (!loader && !transport) {
    log("Not connected.");
    return;
  }

  try {
    setDot("warn");
    setStatus("Resetting...");

    // Preferred: if loader provides a reset method (most robust)
    if (typeof loader?.hardReset === "function") {
      await loader.hardReset();
      log("Reset requested (loader.hardReset).");
    } else if (typeof loader?.reset === "function") {
      await loader.reset();
      log("Reset requested (loader.reset).");
    } else if (transport?.device?.setSignals) {
      // Fallback: toggle DTR/RTS (works on many USB-serial bridges)
      // Typical pattern: pulse RTS low/high briefly.
      await transport.device.setSignals({ dataTerminalReady: false, requestToSend: true });
      await new Promise(r => setTimeout(r, 100));
      await transport.device.setSignals({ dataTerminalReady: false, requestToSend: false });
      log("Reset attempted via DTR/RTS toggle.");
    } else {
      // Last resort: close and reconnect manually
      log("Reset not supported on this device/driver. Unplug/replug or press RESET on the board.");
    }

    setDot("ok");
    setStatus("Connected");
  } catch (err) {
    setDot("bad");
    setStatus("Connected (reset failed)");
    log(`Reset ERROR: ${err?.message || err}`);
  }
});
