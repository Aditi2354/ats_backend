/**This middleware enables Cross-Origin Resource Sharing (CORS), 
allowing the frontend application to communicate with the backend API from different domains. */
import cors from "cors";

const corsMiddleware = cors({
  origin: "*",
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
});

export default corsMiddleware;