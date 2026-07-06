# Full-Stack YouTube to MP3 Converter

A fast, fully automated full-stack web application that allows users to extract metadata from YouTube videos and convert them into downloadable MP3 files. 

This project utilizes a React frontend and a Node.js Express backend, leveraging the power of `yt-dlp` and `ffmpeg` wrapped in cross-platform Node modules to handle media processing seamlessly.

## ✨ Features

* **Instant Metadata Extraction:** Fetches the official video title, thumbnail, and duration before conversion.
* **High-Quality Audio Conversion:** Uses `ffmpeg` to rip and encode the best available audio stream directly to MP3.
* **Cross-Platform Execution:** Built with `youtube-dl-exec` and `ffmpeg-static` to ensure the conversion engine runs effortlessly on both Mac and Windows environments without complex OS-level installations.
* **Automated Server Cleanup:** Features a built-in background job that automatically sweeps and deletes temporary audio files to prevent server storage bloat.
* **Secure Delivery:** Keeps the media processing securely on the backend, only exposing a static, short-lived download link to the client.

## 🛠️ Tech Stack

**Frontend:**
* React.js (Vite)
* Axios (API Client)
* Vanilla CSS

**Backend:**
* Node.js (Express)
* `youtube-dl-exec` (Wrapper for yt-dlp)
* `ffmpeg-static` (Audio encoding)
* CORS & Dotenv

## 📋 Prerequisites

Before cloning this repository, ensure you have the following installed on your machine:
* **Node.js** (v16.0 or higher)
* **Python** (v3.10 or higher is **strictly required** for the `yt-dlp` engine to function)
* **Git**

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone [https://github.com/HoelyMoly929/yt-to-mp3-converter.git](https://github.com/HoelyMoly929/yt-to-mp3-converter.git)
cd yt-to-mp3-converter
