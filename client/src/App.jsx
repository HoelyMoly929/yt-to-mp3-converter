import { useState } from "react";
import apiClient from "./api";
import "./App.css";

function App() {
  // --- 1. STATE HOOKS ---
  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState(null);
  const [downloadLink, setDownloadLink] = useState(null);

  // UI states to handle spinners and error messages
  const [isLoading, setIsLoading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState(null);

  // --- 2. LOGIC: Fetch Video Info ---
  // Triggered when the user pastes a link and clicks "Check Video"
  const handleCheckVideo = async (e) => {
    e.preventDefault();
    if (!url) return;

    setIsLoading(true);
    setError(null);
    setVideoInfo(null);
    setDownloadLink(null);

    try {
      // Hits our GET /api/info route
      const response = await apiClient.get(
        `/info?url=${encodeURIComponent(url)}`,
      );
      setVideoInfo(response.data);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Failed to fetch video details. Please check the URL.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // --- 3. LOGIC: Convert & Download ---
  // Triggered when the user confirms the thumbnail and clicks "Convert to MP3"
  const handleConvert = async () => {
    setIsConverting(true);
    setError(null);

    try {
      // Hits our POST /api/convert route
      const response = await apiClient.post("/convert", { url });

      if (response.data.success) {
        // We combine our backend host with the relative link provided
        setDownloadLink(`http://localhost:5001${response.data.downloadLink}`);
      }
    } catch {
      setError("An error occurred during conversion. Please try again.");
    } finally {
      setIsConverting(false);
    }
  };

  // --- 4. THE UI RENDER ---
  return (
    <div className="app-container">
      <header>
        <h1>YouTube to MP3</h1>
        <p>Fast, secure, and fully automated.</p>
      </header>

      {/* Error Display */}
      {error && <div className="error-box">{error}</div>}

      {/* URL Input Form */}
      <form onSubmit={handleCheckVideo} className="input-group">
        <input
          type="url"
          placeholder="Paste YouTube link here... (e.g., https://youtube.com/watch?v=...)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isLoading || isConverting}
          required
        />
        <button type="submit" disabled={!url || isLoading || isConverting}>
          {isLoading ? "Searching..." : "Check Video"}
        </button>
      </form>

      {/* Video Metadata & Conversion Preview */}
      {videoInfo && !downloadLink && (
        <div className="preview-card">
          <img
            src={videoInfo.thumbnail}
            alt="Video Thumbnail"
            className="thumbnail"
          />
          <div className="video-details">
            <h3>{videoInfo.title}</h3>
            <p>Duration: {videoInfo.duration}</p>
          </div>
          <button
            onClick={handleConvert}
            disabled={isConverting}
            className={`convert-btn ${isConverting ? "pulsing" : ""}`}
          >
            {isConverting
              ? "Converting Audio... Please wait."
              : "Convert to MP3"}
          </button>
        </div>
      )}

      {/* Download Ready Section */}
      {downloadLink && (
        <div className="success-card">
          <h3>✅ Conversion Complete!</h3>
          <a href={downloadLink} download className="download-btn">
            Download MP3 File
          </a>
          <button
            className="reset-btn"
            onClick={() => {
              setUrl("");
              setVideoInfo(null);
              setDownloadLink(null);
            }}
          >
            Convert Another Video
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
