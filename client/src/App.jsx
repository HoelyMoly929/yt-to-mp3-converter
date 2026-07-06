import { useState } from "react";
import apiClient, { API_ORIGIN } from "./api";
import "./App.css";

function App() {
  // --- 1. STATE HOOKS ---
  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState(null);
  const [downloadLink, setDownloadLink] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState(null);

  // NEW STATES FOR PROGRESS
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  // --- 2. LOGIC: Fetch Video Info ---
  // Triggered when the user pastes a link and clicks "Check Video"
  const handleCheckVideo = async (e) => {
    e.preventDefault();
    const videoUrl = url.trim();
    if (!videoUrl) return;

    setIsLoading(true);
    setError(null);
    setVideoInfo(null);
    setDownloadLink(null);
    setUrl(videoUrl);

    try {
      // Hits our GET /api/info route
      const response = await apiClient.get(
        `/info?url=${encodeURIComponent(videoUrl)}`,
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
  const handleConvert = () => {
    const videoUrl = url.trim();
    if (!videoUrl) {
      setError("Please paste a valid YouTube URL.");
      return;
    }

    setIsConverting(true);
    setError(null);
    setProgress(0);
    setStatusMessage("Initializing...");

    // Open the live connection to our new streaming endpoint
    // Open the live connection with explicit credentials allowed
    const eventSource = new EventSource(
      `${API_ORIGIN}/api/convert-stream?url=${encodeURIComponent(videoUrl)}`,
      { withCredentials: true },
    );

    // Listen for incoming data packets
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.status === "processing") {
        setStatusMessage(data.message);
      } else if (data.status === "downloading") {
        setProgress(Number(data.progress));
        setStatusMessage(`Downloading... ${data.progress}%`);
      } else if (data.status === "complete") {
        setDownloadLink(`${API_ORIGIN}${data.downloadLink}`);
        setIsConverting(false);
        setStatusMessage("");
        eventSource.close(); // Close connection when finished
      } else if (data.status === "error") {
        setError(data.message);
        setIsConverting(false);
        eventSource.close();
      }
    };

    // Handle network drops
    eventSource.onerror = () => {
      setError("Lost connection to the server. Please try again.");
      setIsConverting(false);
      eventSource.close();
    };
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
          {/* New Progress Bar UI */}
          {isConverting && (
            <div className="progress-container">
              <p className="status-text">{statusMessage}</p>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
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
