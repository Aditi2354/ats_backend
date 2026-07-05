/*This middleware uses Multer to handle file uploads, 
allowing users to upload resume PDF files which are then processed by the backend for analysis. */
import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({ storage });

export default upload;