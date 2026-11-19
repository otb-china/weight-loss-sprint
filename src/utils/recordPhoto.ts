import workerPath from "tesseract.js/dist/worker.min.js?url";

export async function prepareRecordPhoto(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 2200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function recognizeRecordPhoto(photo: string, kind: "weight" | "exercise", signal: AbortSignal) {
  const { createWorker } = await import("tesseract.js");
  if (signal.aborted) return {};
  let timer: number | undefined;
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  let reportError: (reason: unknown) => void = () => {};
  const cancel = () => reportError(new Error("OCR canceled"));
  let finished = false;
  try {
    const failure = new Promise<never>((_, reject) => {
      reportError = reject;
      timer = window.setTimeout(() => reject(new Error("OCR timed out")), 60_000);
    });
    signal.addEventListener("abort", cancel, { once: true });
    const recognition = async () => {
      worker = await createWorker("chi_sim+eng", undefined, {
        workerPath,
        workerBlobURL: false,
        errorHandler: reportError,
      });
      if (finished) {
        await worker.terminate();
        return "";
      }
      const { data } = await worker.recognize(photo);
      return data.text;
    };
    return parseRecordPhoto(await Promise.race([recognition(), failure]), kind);
  } finally {
    finished = true;
    signal.removeEventListener("abort", cancel);
    window.clearTimeout(timer);
    await worker?.terminate();
  }
}

function parseRecordPhoto(raw: string, kind: "weight" | "exercise"): {
  amount?: number;
  distanceKm?: number;
  calories?: number;
} {
  const text = raw.normalize("NFKC").toLowerCase()
    .replace(/(\d),(?=\d{3}(?:\D|$))/g, "$1")
    .replace(/(\d)[.,][ \t]*(?=\d)/g, "$1.");
  const number = /(\d+(?:\.\d+)?)/.source;

  function findValue(pattern: RegExp, convert: (match: RegExpMatchArray) => number = (match) => Number(match[1])) {
    const values = new Set(Array.from(text.matchAll(pattern), convert).filter((value) => Number.isFinite(value) && value > 0));
    return values.size === 1 ? [...values][0] : undefined;
  }

  if (kind === "weight") {
    const weightWithUnit = new RegExp(number + /\s*(k\s*g\b|公斤|千克|斤|lbs?\b)/.source, "g");
    const amount = text.match(weightWithUnit)
      ? findValue(weightWithUnit, (match) => {
        const unit = match[2];
        const factor = unit === "斤" ? 0.5 : unit.startsWith("lb") ? 0.45359237 : 1;
        return Number((Number(match[1]) * factor).toFixed(2));
      })
      : findValue(new RegExp(/^[ \t]*/.source + number + /[ \t]*$/.source, "gm"));
    return { amount };
  }

  const endOfLine = /[ \t]*(?=\n|$)/.source;
  const distanceKm = findValue(new RegExp(number + /\s*(?:k\s*m\b|公里|千米)(?!\s*\/)/.source, "g"))
    ?? findValue(new RegExp(number + /\s*(?:mi\b|英里)(?!\s*\/)/.source, "g"), (match) => Number((Number(match[1]) * 1.609344).toFixed(2)))
    ?? findValue(new RegExp(/(?:距离|distance)\s*:?\s*/.source + number + endOfLine, "g"));
  const calories = findValue(new RegExp(number + /\s*(?:kcal\b|cal\b|大卡|千卡|卡路里)/.source, "g"))
    ?? findValue(new RegExp(/(?:热量|消耗|calories)\s*:?\s*/.source + number + endOfLine, "g"));

  const clock = /(\d{1,3})\s*:\s*([0-5]\d)(?:\s*:\s*([0-5]\d))?(?![\d:])/.source;
  const clockToMinutes = (match: RegExpMatchArray) => match[3] === undefined
    ? Number(match[1]) + Number(match[2]) / 60
    : Number(match[1]) * 60 + Number(match[2]) + Number(match[3]) / 60;
  const duration = findValue(new RegExp(/(?:运动时长|用时|耗时|时长|duration|(?:elapsed|moving) time)\s*:?\s*/.source + clock, "g"), clockToMinutes)
    ?? findValue(/(?:(\d+)\s*(?:小时|h(?:rs?)?\b)\s*)?(\d+(?:\.\d+)?)\s*(?:分钟|分(?!钟)|min(?:s|utes?)?\b)(?:\s*(\d+)\s*(?:秒|s(?:ec)?\b))?(?![ \t]*\/)/g,
      (match) => Number(match[1] || 0) * 60 + Number(match[2]) + Number(match[3] || 0) / 60)
    ?? findValue(new RegExp(/^[ \t]*/.source + clock + /[ \t]*$/.source, "gm"), clockToMinutes);

  return { amount: duration === undefined ? undefined : Math.max(1, Math.round(duration)), distanceKm, calories };
}
