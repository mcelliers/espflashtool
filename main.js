import { ESPLoader, Transport } from "https://unpkg.com/esptool-js@0.5.7/bundle.js";

const btnConnect = document.getElementById("btnConnect");
const btnFlash   = document.getElementById("btnFlash");
const statusEl   = document.getElementById("status");
const logEl      = document.getElementById("log");
const binInput   = document.getElementById("binFile");
const chkErase   = document.getElementById("chkErase");
const baudSel    = document.getElementById("baud");

let loader = null;

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

    const binData = new Uint8Array(await file.arrayBuffer());

    log("Writing firmware (offset 0x0)...");
    await loader.writeFlash({
      fileArray: [{ data: binData, address: 0x0 }],
      flashSize: "keep",
      flashMode: "keep",
      flashFreq: "keep",
      compress: true,
      reportProgress: (_i, written, total) => {
        const pct = ((written / total) * 100).toFixed(1);
        setStatus(`Flashing... ${pct}%`);
      },
    });

    log("Flash complete.");
    setStatus("Done");

  } catch (err) {
    log(`ERROR: ${err?.message || err}`);
    setStatus("Failed");
  } finally {
    btnFlash.disabled = false;
  }
});
