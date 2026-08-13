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

    function getBodyHtml({ title, documentText, summaryHtml, summaryText, imageAnalysisHtml, imageAnalysisText }) {
        if (documentText && String(documentText).trim()) {
            return `
                <h1>${escapeHtml(title)}</h1>
                <div class="export-document-body">${textToHtml(String(documentText))}</div>
            `;
        }

        const summaryBlock = summaryHtml && String(summaryHtml).trim()
            ? String(summaryHtml)
            : textToHtml(summaryText || "");
        const imageBlock = imageAnalysisHtml && String(imageAnalysisHtml).trim()
            ? String(imageAnalysisHtml)
            : textToHtml(imageAnalysisText || "");

        return `
            <h1>${escapeHtml(title)}</h1>
            ${summaryBlock ? `<section class="export-section"><h2>會議總結</h2><div class="export-section-body">${summaryBlock}</div></section>` : ""}
            ${imageBlock ? `<section class="export-section"><h2>圖片分析結果</h2><div class="export-section-body">${imageBlock}</div></section>` : ""}
        `;
    }

    function getStyles() {
        return `
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
            pre, code, .export-section-body, .export-document-body {
                white-space: pre-wrap;
                word-break: break-word;
            }
            .export-section,
            .export-document-body {
                margin-bottom: 28px;
            }
            .image-analysis-card,
            .transcript-image-card {
                display: block;
                margin-bottom: 16px;
            }
        `;
    }

    function buildWordHtml(options) {
        return `
            <!DOCTYPE html>
            <html lang="zh-TW">
            <head>
                <meta charset="UTF-8">
                <title>${escapeHtml(options.title)}</title>
                <style>${getStyles()}</style>
            </head>
            <body>
                ${getBodyHtml(options)}
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

    function exportWord(options) {
        const html = buildWordHtml(options);
        const blob = new Blob(["\ufeff", html], { type: "application/msword" });
        downloadBlob(blob, `${sanitizeFileName(options.baseFileName)}.doc`);
    }

    async function exportPdf(options) {
        if (!window.html2pdf) {
            throw new Error("PDF 匯出套件尚未載入");
        }

        const wrapper = document.createElement("div");
        wrapper.style.position = "fixed";
        wrapper.style.left = "0";
        wrapper.style.top = "0";
        wrapper.style.width = "794px";
        wrapper.style.minHeight = "1123px";
        wrapper.style.padding = "32px";
        wrapper.style.boxSizing = "border-box";
        wrapper.style.background = "#ffffff";
        wrapper.style.color = "#1f2933";
        wrapper.style.fontFamily = '"Microsoft JhengHei", "PingFang TC", sans-serif';
        wrapper.style.lineHeight = "1.7";
        wrapper.style.visibility = "visible";
        wrapper.style.pointerEvents = "none";
        wrapper.style.zIndex = "-1";
        wrapper.innerHTML = getBodyHtml(options);
        document.body.appendChild(wrapper);

        try {
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            await window.html2pdf()
                .set({
                    margin: [0, 0, 0, 0],
                    filename: `${sanitizeFileName(options.baseFileName)}.pdf`,
                    image: { type: "jpeg", quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
                    jsPDF: { unit: "px", format: [794, Math.max(wrapper.scrollHeight, 1123)], orientation: "portrait" },
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
