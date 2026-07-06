import axios from "axios";

export const API_BASE_URL = "http://localhost:5001/api";
export const API_ORIGIN = new URL(API_BASE_URL).origin;

// Create a pre-configured Axios instance
const apiClient = axios.create({
  // This points to the Express server we just built
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiClient;
