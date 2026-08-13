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

    function textToHtml(text) {
        return escapeHtml(text || "").replace(/\n/g, "<br>");
    }

    function normalizeSectionContent(contentHtml, contentText) {
        if (contentHtml && String(contentHtml).trim()) return String(contentHtml);
        if (contentText && String(contentText).trim()) return textToHtml(String(contentText));
        return "";
    }

    function createSectionHtml(title, contentHtml, contentText) {
        const content = normalizeSectionContent(contentHtml, contentText);
        if (!content) return "";

        return `
            <section class="export-section">
                <h2>${escapeHtml(title)}</h2>
                <div class="export-section-body">${content}</div>
            </section>
        `;
    }

    function buildDocumentHtml({ title, documentText, summaryHtml, summaryText, imageAnalysisHtml, imageAnalysisText }) {
        const fullDocumentContent = documentText && String(documentText).trim()
            ? `<div class="export-document-body">${textToHtml(String(documentText))}</div>`
            : [
                createSectionHtml("會議總結", summaryHtml, summaryText),
                createSectionHtml("圖片分析結果", imageAnalysisHtml, imageAnalysisText)
            ].filter(Boolean).join("");

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
                        background: #fff;
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
                    p, li, div, span {
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
                    .export-section,
                    .export-document-body {
                        margin-bottom: 28px;
                    }
                    .export-section-body,
                    .export-document-body {
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
                ${fullDocumentContent}
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

    function exportWord({ title, documentText, summaryHtml, summaryText, imageAnalysisHtml, imageAnalysisText, baseFileName }) {
        const html = buildDocumentHtml({ title, documentText, summaryHtml, summaryText, imageAnalysisHtml, imageAnalysisText });
        const blob = new Blob(["\ufeff", html], { type: "application/msword" });
        downloadBlob(blob, `${sanitizeFileName(baseFileName)}.doc`);
    }

    async function exportPdf({ title, documentText, summaryHtml, summaryText, imageAnalysisHtml, imageAnalysisText, baseFileName }) {
        if (!window.html2pdf) {
            throw new Error("PDF 匯出套件尚未載入");
        }

        const wrapper = document.createElement("div");
        wrapper.style.position = "absolute";
        wrapper.style.left = "0";
        wrapper.style.top = "0";
        wrapper.style.width = "794px";
        wrapper.style.opacity = "0";
        wrapper.style.pointerEvents = "none";
        wrapper.style.zIndex = "-1";
        wrapper.style.background = "#fff";
        wrapper.innerHTML = buildDocumentHtml({ title, documentText, summaryHtml, summaryText, imageAnalysisHtml, imageAnalysisText });
        document.body.appendChild(wrapper);

        try {
            await window.html2pdf()
                .set({
                    margin: [12, 12, 12, 12],
                    filename: `${sanitizeFileName(baseFileName)}.pdf`,
                    image: { type: "jpeg", quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
                    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
                    pagebreak: { mode: ["css", "legacy"] }
                })
                .from(wrapper)
                .save();
        } finally {
            document.body.removeChild(wrapper);
        }
    }

    return {
        exportMarkdown,
        exportWord,
        exportPdf,
        textToHtml,
        sanitizeFileName
    };
})();
