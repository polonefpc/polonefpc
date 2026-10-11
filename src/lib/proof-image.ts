export async function compressProof(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) throw new Error("اختر صورة بحجم أقل من 15 ميغابايت");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("تعذر تجهيز الصورة");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.65, 0.45, 0.3]) {
      const value = canvas.toDataURL("image/jpeg", quality);
      if (value.length < 1000000) return value;
    }
    throw new Error("الصورة كبيرة؛ اختر صورة أصغر");
  } finally { bitmap.close(); }
}