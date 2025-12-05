/**
 * 画像を自動圧縮（2〜3MB以下に縮小）
 * @param file - 元の画像ファイル
 * @param maxWidth - 最大幅（デフォルト 1280px）
 * @param maxHeight - 最大高さ（デフォルト 1280px）
 * @param quality - JPEG品質（0〜1、デフォルト 0.7）
 * @returns 圧縮されたBlob
 */
export async function compressImage(
  file: File,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.7
): Promise<Blob> {
  const img = new Image();
  img.src = URL.createObjectURL(file);

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
  });

  let { width, height } = img;

  // 縦横比を保ったまま縮小
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  width = width * ratio;
  height = height * ratio;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  ctx.drawImage(img, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('画像の圧縮に失敗しました'));
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}
