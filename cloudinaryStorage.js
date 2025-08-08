// config/cloudinaryStorage.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'attendance-photos', // ✅ folder in your Cloudinary account
    allowed_formats: ['jpg', 'jpeg', 'png'],
    public_id: (req, file) => Date.now() + '-' + file.originalname.split('.')[0], // optional custom filename
  },
});

const upload = multer({ storage });
module.exports = upload;
