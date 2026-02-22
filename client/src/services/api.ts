// src/services/api.ts
// Axios wrapper for backend API calls

import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// TODO: Implement sendMessage()
//   - POST /chat with { message, sessionId? }
//   - Return ChatResponse (reply + debug info)

export default api;
