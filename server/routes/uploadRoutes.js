const express = require("express");
const multer = require("multer");
const router = express.Router();
const cloudinary = require("../config/cloudinary");

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/", upload.single("file"), async (req, res) => {
  try {
    console.log("========== UPLOAD REQUEST ==========");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("File:", req.file);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file received",
      });
    }

    const isPdf = req.file.mimetype === "application/pdf";

    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: isPdf ? "raw" : "image",
        folder: "yapester",
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary Error:", error);

          return res.status(500).json({
            success: false,
            message: "Cloudinary upload failed",
            error: error.message,
          });
        }

        console.log("Upload Success:", result.secure_url);

        return res.status(200).json({
          success: true,
          url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    stream.end(req.file.buffer);
  } catch (err) {
    console.error("Upload Route Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;
