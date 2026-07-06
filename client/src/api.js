import axios from "axios";

// Create a pre-configured Axios instance
const apiClient = axios.create({
  // This points to the Express server we just built
  baseURL: "http://localhost:5001/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiClient;
