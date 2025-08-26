import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve("public/uploads/videos"));
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + file.originalname;
    cb(null, unique);
  }
});

export const upload = multer({ dest: "uploads/" });