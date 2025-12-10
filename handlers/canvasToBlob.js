const supportedFormats = [
  {
    name: "Portable Network Graphics",
    format: "png",
    extension: "png",
    mime: "image/png",
    from: true,
    to: true,
    internal: "png"
  },
  {
    name: "Joint Photographic Experts Group",
    format: "jpeg",
    extension: "jpg",
    mime: "image/jpeg",
    from: true,
    to: true,
    internal: "jpeg"
  },
  {
    name: "WebP",
    format: "webp",
    extension: "webp",
    mime: "image/webp",
    from: true,
    to: true,
    internal: "webp"
  },
  {
    name: "CompuServe Graphics Interchange Format (GIF)",
    format: "gif",
    extension: "gif",
    mime: "image/gif",
    from: true,
    to: false,
    internal: "gif"
  }
];

let canvas, ctx;

async function init () {
  canvas = document.createElement("canvas");
  ctx = canvas.getContext("2d");
}

async function doConvert (inputFile, inputFormat, outputFormat) {

  const blob = new Blob([inputFile.bytes], { type: inputFormat.mime });
  const url = URL.createObjectURL(blob);

  let image = document.createElement("img");
  await new Promise((resolve, reject) => {
    image.addEventListener("load", resolve);
    image.src = url;
  });

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  ctx.drawImage(image, 0, 0);

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
    }, outputFormat.mime);
  });

}

export default {
  name: "canvasToBlob",
  init,
  supportedFormats,
  doConvert
};
