// Shrinks a photo in the browser and re-encodes it as JPEG before upload, so a
// phone photo of several MB is stored as a small data URL.
export async function resizeImageFile(file: File, { maxSide, maxChars }: { maxSide: number; maxChars: number }): Promise<string> {
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be opened.')); };
    image.src = url;
  });
  const scale = Math.min(1, maxSide / Math.max(source.naturalWidth, source.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(16, Math.round(source.naturalWidth * scale));
  canvas.height = Math.max(16, Math.round(source.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare the photo.');
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.85, 0.75, 0.6, 0.5]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= maxChars) return dataUrl;
  }
  throw new Error('That photo is too detailed to save. Try another one.');
}

// Profile photo: shown small, so 320px is plenty.
export const AVATAR_SIZE = { maxSide: 320, maxChars: 250000 };
// Driver's license or ID: kept large enough for an admin to read the text.
export const ID_PHOTO_SIZE = { maxSide: 1600, maxChars: 900000 };
