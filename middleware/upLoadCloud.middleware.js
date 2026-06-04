const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

module.exports.uploadFile = async (req, res, next) => {
  let arrThumbnail = [];

  // Nếu có thumbnail cũ (từ form), parse nó
  if (req.body.thumbnail) {
    try {
      const oldThumbnails = JSON.parse(req.body.thumbnail);
      arrThumbnail = Array.isArray(oldThumbnails) ? oldThumbnails : [];
    } catch (e) {
      arrThumbnail = [];
    }
  }

  // Nếu có file mới, upload và thêm vào mảng
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const result = await new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
          { folder: "products" },
          (error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          },
        );

        streamifier.createReadStream(file.buffer).pipe(stream);
      });
      arrThumbnail.push(result.secure_url); // push URL mới vào mảng
    }
  }

  req.body.thumbnail = arrThumbnail;

  next();
};
