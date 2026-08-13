window.SummaryExport = (() => {
    function sanitizeFileName(name) {
        const fallback = "meeting_summary";
        return String(name || fallback)
            .replace(/[\\/:*?"<>|]/g, "_")
            .replace(/\s+/g, "_")
            .trim() || fallback;
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function createSectionHtml(title, contentHtml) {
        if (!contentHtml) return "";
        return `
            <section class="export-section">
                <h2>${escapeHtml(title)}</h2>
                <div class="export-section-body">${contentHtml}</div>
            </section>
        `;
    }

    function buildDocumentHtml({ title, summaryHtml, imageAnalysisHtml }) {
        return `
            <!DOCTYPE html>
            <html lang="zh-TW">
            <head>
                <meta charset="UTF-8">
                <title>${escapeHtml(title)}</title>
                <style>
                    body {
                        font-family: "Microsoft JhengHei", "PingFang TC", sans-serif;
                        color: #1f2933;
                        line-height: 1.7;
                        margin: 32px;
                    }
                    h1 {
                        font-size: 24px;
                        margin: 0 0 24px;
                        padding-bottom: 12px;
                        border-bottom: 2px solid #d9e2ec;
                    }
                    h2 {
                        font-size: 18px;
                        margin: 0 0 12px;
                        color: #102a43;
                    }
                    p, li {
                        font-size: 14px;
                    }
                    img {
                        max-width: 100%;
                        height: auto;
                        border-radius: 6px;
                    }
                    pre, code {
                        white-space: pre-wrap;
                        word-break: break-word;
                    }
                    .export-section {
                        margin-bottom: 28px;
                    }
                    .export-section-body {
                        white-space: pre-wrap;
                        word-break: break-word;
                    }
                    .image-analysis-card,
                    .transcript-image-card {
                        display: block;
                        margin-bottom: 16px;
                    }
                </style>
            </head>
            <body>
                <h1>${escapeHtml(title)}</h1>
                ${createSectionHtml("會議總結", summaryHtml)}
                ${createSectionHtml("圖片分析結果", imageAnalysisHtml)}
            </body>
            </html>
        `;
    }

    function downloadBlob(blob, filename) {
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function exportMarkdown(markdownText, baseFileName) {
        const blob = new Blob([markdownText || ""], { type: "text/markdown;charset=utf-8" });
        downloadBlob(blob, `${sanitizeFileName(baseFileName)}.md`);
    }

    function exportWord({ title, summaryHtml, imageAnalysisHtml, baseFileName }) {
        const html = buildDocumentHtml({ title, summaryHtml, imageAnalysisHtml });
        const blob = new Blob(["\ufeff", html], { type: "application/msword" });
        downloadBlob(blob, `${sanitizeFileName(baseFileName)}.doc`);
    }

    async function exportPdf({ title, summaryHtml, imageAnalysisHtml, baseFileName }) {
        if (!window.html2pdf) {
            throw new Error("PDF 匯出套件尚未載入");
        }

        const wrapper = document.createElement("div");
        wrapper.style.position = "fixed";
        wrapper.style.left = "-99999px";
        wrapper.style.top = "0";
        wrapper.style.width = "794px";
        wrapper.innerHTML = buildDocumentHtml({ title, summaryHtml, imageAnalysisHtml });
        document.body.appendChild(wrapper);

        try {
            await window.html2pdf()
                .set({
                    margin: [12, 12, 12, 12],
                    filename: `${sanitizeFileName(baseFileName)}.pdf`,
                    image: { type: "jpeg", quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
                    pagebreak: { mode: ["css", "legacy"] }
                })
                .from(wrapper)
                .save();
        } finally {
            document.body.removeChild(wrapper);
        }
    }

    function textToHtml(text) {
        return escapeHtml(text || "").replace(/\n/g, "<br>");
    }

    return {
        exportMarkdown,
        exportWord,
        exportPdf,
        textToHtml,
        sanitizeFileName
    };
})();
