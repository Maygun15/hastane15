import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";

const authRoutes = require("./routes/auth.routes.js");
const ensureDevAdmin = require("./utils/ensureDevAdmin");

const app = express();
const PORT = process.env.PORT || 10000;

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173,http://localhost:5174,http://localhost:5174/hastane15,https://maygun15.github.io,https://maygun15.github.io/hastane15,https://hastane15.onrender.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS: " + origin));
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("/api/*", cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.send("Backend Sunucusu Başarıyla Çalışıyor!");
});

app.use("/api/auth", authRoutes);

mongoose
  .connect(process.env.MONGODB_URI, { dbName: "hastane" })
  .then(async () => {
    console.log("✅ MongoDB bağlı");
    await ensureDevAdmin();
    app.listen(PORT, () => {
      console.log(`🚀 Sunucu http://localhost:${PORT} üzerinde`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB hatası:", err.message);
    process.exit(1);
  });
