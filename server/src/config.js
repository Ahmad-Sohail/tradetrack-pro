import "dotenv/config";

const required = ["MONGODB_URI", "JWT_SECRET"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 24) {
  console.error("JWT_SECRET must be at least 24 characters.");
  process.exit(1);
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  env: process.env.NODE_ENV || "development",
  clientUrls: (process.env.CLIENT_URL || "http://localhost:3000").split(",").map((s) => s.trim()),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  encryptionKey: process.env.ENCRYPTION_KEY || "",
  syncIntervalMin: process.env.SYNC_INTERVAL_MIN === undefined ? 5 : Number(process.env.SYNC_INTERVAL_MIN),
  adminEmail: (process.env.ADMIN_EMAIL || "").toLowerCase(),
  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  },
};
export const cloudinaryEnabled = () =>
  Boolean(config.cloudinary.cloud_name && config.cloudinary.api_key && config.cloudinary.api_secret);
