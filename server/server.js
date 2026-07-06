import express from "express";
import "dotenv/config";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url"; // Required to recreate __dirname
import pkg from "youtube-dl-exec";
const youtubedl = pkg.default || pkg;
const ytdlExec = pkg.exec || youtubedl.exec;
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

  try {
    console.log(`Starting metadata extraction for: ${url}`);

    // 1. Fetch the metadata first to grab the real video title
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
    });

    // 2. Sanitize the title!
    // This regex removes illegal OS characters: < > : " / \ | ? *
    const cleanTitle = info.title.replace(/[<>:"/\\|?*]+/g, "").trim();

    // 3. Create the exact filename using the sanitized title
    const outputFilename = `${cleanTitle}.mp3`;
    const finalFilePath = path.join(tempDir, outputFilename);

    console.log(`Downloading and converting to: ${outputFilename}`);

    // 4. Run the download engine
    await youtubedl(url, {
      extractAudio: true,
      audioFormat: "mp3",
      audioQuality: 0,
      output: finalFilePath,
      ffmpegLocation: ffmpeg,
      noCheckCertificates: true,
    });

    console.log(`Successfully converted and saved to: ${finalFilePath}`);

    // Return the static link. We use encodeURIComponent so spaces in the title
    // don't break the URL string when sent back to the React frontend.
    res.json({
      success: true,
      downloadLink: `/api/download/${encodeURIComponent(outputFilename)}`,
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
  // Decode the filename to handle spaces and special characters properly
  const filename = decodeURIComponent(req.params.filename);
  const filePath = path.join(tempDir, filename);

  if (fs.existsSync(filePath)) {
    // res.download forces the browser to save the file with the exact title
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
// ROUTE 4: SSE Progress Stream
// ---------------------------------------------------------
app.get("/api/convert-stream", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "YouTube URL is required." });
  }

  // 1. Establish SSE headers to keep the connection open
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  try {
    // Send initial status to the frontend
    res.write(
      `data: ${JSON.stringify({ status: "processing", message: "Fetching metadata..." })}\n\n`,
    );

    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
    });
    const cleanTitle = info.title.replace(/[<>:"/\\|?*]+/g, "").trim();
    const outputFilename = `${cleanTitle}.mp3`;
    const finalFilePath = path.join(tempDir, outputFilename);

    res.write(
      `data: ${JSON.stringify({ status: "processing", message: "Downloading video stream..." })}\n\n`,
    );

    // 2. Start the child process using ytdlExec() so we can read live terminal output
    const subprocess = ytdlExec(url, {
      extractAudio: true,
      audioFormat: "mp3",
      audioQuality: 0,
      output: finalFilePath,
      ffmpegLocation: ffmpeg,
      noCheckCertificates: true,
    });

    // 3. Listen to the live output (stdout)
    subprocess.stdout.on("data", (data) => {
      const text = data.toString();

      // Use regex to scrape the percentage (e.g., "[download]  45.5%")
      const progressMatch = text.match(/\[download\]\s+([\d\.]+)%/);
      if (progressMatch) {
        res.write(
          `data: ${JSON.stringify({ status: "downloading", progress: progressMatch[1] })}\n\n`,
        );
      }

      // Detect when yt-dlp finishes downloading and hands off to FFmpeg for conversion
      if (text.includes("[ExtractAudio]")) {
        res.write(
          `data: ${JSON.stringify({ status: "processing", message: "Converting to MP3 (this may take a minute)..." })}\n\n`,
        );
      }
    });

    // 4. Handle completion and close the stream
    subprocess.on("close", (code) => {
      if (code === 0) {
        res.write(
          `data: ${JSON.stringify({ status: "complete", downloadLink: `/api/download/${encodeURIComponent(outputFilename)}` })}\n\n`,
        );
      } else {
        res.write(
          `data: ${JSON.stringify({ status: "error", message: "Conversion process failed." })}\n\n`,
        );
      }
      res.end(); // Safely closes the SSE connection
    });
  } catch (error) {
    console.error("Stream error:", error);
    res.write(
      `data: ${JSON.stringify({ status: "error", message: "An unexpected error occurred." })}\n\n`,
    );
    res.end();
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
