# espflashtool
Easily Program The ESP32S3 From the Web Browser

## Features

- 🌐 **Web-based flashing** - No software installation required
- 📁 **File selection** - Choose your .bin firmware file
- 🔌 **COM port selection** - Browser automatically prompts for port selection
- 🗑️ **Memory erase option** - Optionally erase flash before flashing
- 📍 **Flash offset configuration** - Select the appropriate memory offset
- ✨ **Modern UI** - Clean, responsive interface

## Usage

1. Open `index.html` in a Chromium-based browser (Chrome, Edge, Opera)
2. Select your firmware .bin file
3. Choose the flash offset (default: 0x10000 for applications)
4. Check "Erase flash before flashing" if you want to clear memory first
5. Click "Connect and Flash ESP32S3"
6. Select your ESP32S3's COM port from the browser dialog
7. Wait for the flashing process to complete

## Requirements

- Chromium-based browser (Chrome, Edge, Opera) with Web Serial API support
- ESP32S3 device connected via USB
- Firmware .bin file

## GitHub Pages

This tool can be hosted on GitHub Pages for easy access. Simply enable GitHub Pages in your repository settings and point it to the main branch.

## Technical Details

This tool uses:
- [esptool-js](https://github.com/espressif/esptool-js) - JavaScript implementation of esptool
- Web Serial API - For browser-based serial communication
- Modern HTML5/CSS3/JavaScript - No build process required

