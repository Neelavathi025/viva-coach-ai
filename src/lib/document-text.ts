/**
 * Browser-side text extraction for PDF / DOCX / TXT / MD.
 * Only the extracted plain text is ever sent to the server.
 */
import { MAX_FILE_BYTES } from "./viva-types";

export class DocumentError extends Error {}

const TEXT_EXT = ["txt", "md", "markdown", "text"];

function extOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new DocumentError("This file is larger than 10 MB. Please upload a smaller document.");
  }
  const ext = extOf(file.name);

  if (TEXT_EXT.includes(ext)) {
    return (await file.text()).trim();
  }

  if (ext === "pdf") {
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = (
        await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ).default;
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      let out = "";
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        out +=
          content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
            .replace(/\s+/g, " ") + "\n\n";
      }
      return out.trim();
    } catch {
      throw new DocumentError(
        "This PDF could not be read. Please try another file or paste the project text manually.",
      );
    }
  }

  if (ext === "docx") {
    try {
      const mammoth = await import("mammoth/mammoth.browser.js");
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return result.value.trim();
    } catch {
      throw new DocumentError(
        "This Word document could not be read. Please save it as .docx or paste the project text manually.",
      );
    }
  }

  if (ext === "doc") {
    throw new DocumentError("Old .doc files are not supported. Please upload a .docx, PDF or TXT.");
  }

  throw new DocumentError("Unsupported file type. Please upload a PDF, DOCX, TXT or MD file.");
}
