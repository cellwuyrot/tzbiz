import "dotenv/config";
import { checkImageProcessor } from "../lib/image-processor";
async function main() {
if (await checkImageProcessor()) console.log("ImageMagick: PNG decoding/encoding succeeded; no sharp native module used.");
else { console.error("Image processing unavailable. Install ImageMagick with convert/identify and PNG/JPEG/WebP support; check config/imagemagick/policy.xml."); process.exitCode = 1; }

}
main().catch(() => { console.error("Image processor check failed."); process.exitCode = 1; });
