const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Hàm upload avatar (ảnh đại diện) lên Cloudinary
/**
 * Upload avatar image to Cloudinary
 * @param {Buffer} buffer - Ảnh buffer
 * @param {string} publicId - Tên file lưu trên Cloudinary
 * @returns {Promise<string>} - URL ảnh
 */
function uploadAvatar(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: "avatars",
        public_id: publicId,
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        overwrite: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

module.exports = Object.assign(cloudinary, { uploadAvatar });
