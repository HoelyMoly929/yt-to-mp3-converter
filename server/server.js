import express from "express";
import "dotenv/config";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url"; // Required to recreate __dirname
import youtubedl from "youtube-dl-exec";
import ffmpeg from "ffmpeg-static";

// 1. Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// Explicitly allow requests from your Vite frontend
app.use(
  cors({
    origin: "http://localhost:5173", // Must match your React app's URL exactly
    methods: ["GET", "POST"], // Allow these specific HTTP methods
    credentials: true, // Allow cookies/authorization headers if needed
  }),
);
app.use(express.json());

// Create the temporary downloads directory if it does not exist
const tempDir = path.join(__dirname, "temp_downloads");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// ---------------------------------------------------------
// ROUTE 1: Fetch Video Metadata & Thumbnail
// ---------------------------------------------------------
app.get("/api/info", async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).json({ error: "YouTube URL is required." });
  }

  try {
    // We use the --dump-json flag to get the metadata without downloading the video
    const info = await youtubedl(videoUrl, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
    });

    res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration_string,
    });
  } catch (error) {
    console.error("Error fetching video info:", error);
    res.status(500).json({
      error: "Failed to retrieve video details. Ensure the link is valid.",
    });
  }
});

// ---------------------------------------------------------
// ROUTE 2: Download and Convert to MP3
// ---------------------------------------------------------
app.post("/api/convert", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res
      .status(400)
      .json({ error: "YouTube URL is required in the request body." });
  }

  // Generate a unique filename using a timestamp to prevent overwriting
  const fileId = `audio_${Date.now()}`;
  const outputFilename = `${fileId}.mp3`;
  const finalFilePath = path.join(tempDir, outputFilename);

  try {
    console.log(`Starting conversion for: ${url}`);

    await youtubedl(url, {
      extractAudio: true,
      audioFormat: "mp3",
      audioQuality: 0, // 0 is the best quality
      output: finalFilePath,
      ffmpegLocation: ffmpeg, // Points yt-dlp to our local npm ffmpeg binary
      noCheckCertificates: true,
    });

    console.log(`Successfully converted and saved to: ${finalFilePath}`);

    // Return the static link that the frontend will use to download the file
    res.json({
      success: true,
      downloadLink: `/api/download/${outputFilename}`,
    });
  } catch (error) {
    console.error("Conversion failed:", error);
    res.status(500).json({ error: "Failed to process the audio conversion." });
  }
});

// ---------------------------------------------------------
// ROUTE 3: Serve the MP3 File for Download
// ---------------------------------------------------------
app.get("/api/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(tempDir, filename);

  // Security check: ensure the file exists before attempting to send it
  if (fs.existsSync(filePath)) {
    // res.download forces the browser to download the file rather than trying to play it
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error("Error sending file to client:", err);
      }
    });
  } else {
    res.status(404).json({ error: "File not found or has expired." });
  }
});

// ---------------------------------------------------------
// BACKGROUND JOB: Cleanup Old Files
// ---------------------------------------------------------
// This runs every 15 minutes to delete files older than 30 minutes
setInterval(
  () => {
    fs.readdir(tempDir, (err, files) => {
      if (err) return console.error("Cleanup error:", err);

      files.forEach((file) => {
        const filePath = path.join(tempDir, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return;

          const now = new Date().getTime();
          const fileAge = now - stats.mtime.getTime(); // Time since last modified
          const thirtyMinutes = 30 * 60 * 1000;

          if (fileAge > thirtyMinutes) {
            fs.unlink(filePath, (err) => {
              if (!err) console.log(`Auto-deleted old file: ${file}`);
            });
          }
        });
      });
    });
  },
  15 * 60 * 1000,
); // 15 minutes in milliseconds

// Start the server
app.listen(PORT, () => {
  console.log(`Media engine backend is running on http://localhost:${PORT}`);
});
