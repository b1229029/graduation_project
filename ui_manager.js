/**
 * ui_manager.js
 *
 * 前端畫面狀態管理器。所有與 DOM 更新、頁面切換、逐字稿顯示、摘要渲染、
 * 圖片分析紀錄與 markmap 心智圖互動有關的工作都集中在這裡。
 *
 * record.js 負責資料流與後端溝通；UIManager 負責把資料轉成使用者看得懂的畫面。
 */
const UIManager = {
    // myTopics 是使用者設定的議程；topicToTranscriptId 用來讓已命中的議程可跳到逐字稿位置。
    myTopics: [], topicToTranscriptId: {},
    // fullTranscriptLog 保存含時間戳、情緒標記與議程命中的完整逐字稿。
    fullTranscriptLog: [], imageAnalysisLog: [], chunkCounter: 0,
    // mindmapTimestamps 與 targetEndTime 用於點擊心智圖節點後播放對應音訊片段。
    mindmapTimestamps: [], targetEndTime: null,
    pendingMindmapRoot: null, currentMode: 'mic',
    isAgendaLocked: false, meetingStartTime: null,
    currentSummaryData: "", els: {},

    init(initialTopic) {
        // 從 dashboard 建立會議時會把會議標題帶進 query string，這裡先加入議程。
        if (initialTopic) this.myTopics.push(initialTopic);

        const ids = ['actionButton', 'statusText', 'live-transcript', 'full-transcript', 'agenda-list', 'warning-msg', 
                     'new-topic-input', 'add-topic-btn', 'input-area', 'file-upload-area', 'audio-file-input', 
                     'ai-summary-box', 'template-select', 'markmap-svg', 'downloadBtn', 'downloadWordBtn', 'downloadPdfBtn', 'copyBtn', 
                     'image-analysis-result-section', 'image-analysis-result-box',
                     'next-agenda-preview', 'next-meeting-time', 'next-emails', 'btn-schedule-next', 
                     'cal-status', 'btn-upload-image', 'image-input', 'img-status', 'interim-summary-box', 'mindmap-audio-player'];
                     
        ids.forEach(id => {
            let key = id.replace(/-([a-z])/g, g => g[1].toUpperCase()); 
            this.els[key] = document.getElementById(id);
        });

        this.ensureSummaryExportButtons();
        this.bindEvents();
        this.renderAgendaList();
        this.toggleMode(); 
    },

    ensureSummaryExportButtons() {
        if (!this.els.downloadBtn) return;

        const buttonGroup = this.els.downloadBtn.parentElement;
        if (!buttonGroup) return;

        if (!this.els.downloadWordBtn) {
            const wordBtn = document.createElement('button');
            wordBtn.id = 'downloadWordBtn';
            wordBtn.className = 'btn-info';
            wordBtn.disabled = true;
            wordBtn.textContent = '下載 Word';
            buttonGroup.insertBefore(wordBtn, this.els.copyBtn || null);
            this.els.downloadWordBtn = wordBtn;
        }

        if (!this.els.downloadPdfBtn) {
            const pdfBtn = document.createElement('button');
            pdfBtn.id = 'downloadPdfBtn';
            pdfBtn.className = 'btn-info';
            pdfBtn.disabled = true;
            pdfBtn.textContent = '下載 PDF';
            buttonGroup.insertBefore(pdfBtn, this.els.copyBtn || null);
            this.els.downloadPdfBtn = pdfBtn;
        }
    },

    bindEvents() {
        // 綁定所有純 UI 事件；需要和後端互動的事件由 record.js 接手。
        if (this.els.imageInput) {
            this.els.imageInput.onchange = () => {
                if (this.els.imageInput.files.length > 0) {
                    this.els.btnUploadImage.style.display = 'inline-block';
                    this.els.imgStatus.textContent = `已選取: ${this.els.imageInput.files[0].name}`;
                }
            };
        }

        this.els.addTopicBtn.onclick = () => {
            const val = this.els.newTopicInput.value.trim();
            if (val) { this.myTopics.push(val); this.els.newTopicInput.value = ''; this.renderAgendaList(); }
        };
        this.els.newTopicInput.addEventListener("keypress", (e) => { if (e.key === "Enter") this.els.addTopicBtn.click(); });
        
        if (this.els.markmapSvg) this.els.markmapSvg.addEventListener('click', (e) => this.handleMindmapClick(e));

        if (this.els.downloadBtn) {
            this.els.downloadBtn.onclick = () => {
                if (window.SummaryExport) {
                    window.SummaryExport.exportMarkdown(this.currentSummaryData, this.getSummaryFileName());
                    return;
                }

                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([this.currentSummaryData], { type: 'text/markdown' }));
                a.download = 'meeting_notes.md'; a.click();
            };
        }
        if (this.els.downloadWordBtn) {
            this.els.downloadWordBtn.onclick = () => {
                if (!window.SummaryExport) {
                    alert("Word 匯出功能尚未載入。");
                    return;
                }
                window.SummaryExport.exportWord(this.getSummaryExportOptions());
            };
        }
        if (this.els.downloadPdfBtn) {
            this.els.downloadPdfBtn.onclick = async () => {
                if (!window.SummaryExport) {
                    alert("PDF 匯出功能尚未載入。");
                    return;
                }

                const button = this.els.downloadPdfBtn;
                const originalText = button.textContent;
                button.disabled = true;
                button.textContent = '產生 PDF 中...';
                try {
                    await window.SummaryExport.exportPdf(this.getSummaryExportOptions());
                } catch (error) {
                    console.error(error);
                    alert(`PDF 匯出失敗：${error.message}`);
                } finally {
                    button.disabled = false;
                    button.textContent = originalText;
                }
            };
        }
        if (this.els.copyBtn) this.els.copyBtn.onclick = () => navigator.clipboard.writeText(this.currentSummaryData).then(() => alert("已複製！"));

        window.switchPage = (pageName) => this.switchPage(pageName);
        window.toggleMode = () => this.toggleMode();
        window.removeTopic = (index) => { this.myTopics.splice(index, 1); this.renderAgendaList(); };
    },

    switchPage(pageName) {
        // 單頁式介面以 class active 控制目前顯示的頁面與導覽按鈕。
        document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
        const targetPage = document.getElementById(`page-${pageName}`);
        if(targetPage) targetPage.classList.add('active');
        
        // 🚀 關鍵修改：支援 4 個頁面的切換邏輯
        let btnIndex = 0;
        if (pageName === 'summary') btnIndex = 1;
        else if (pageName === 'mindmap') btnIndex = 2;
        else if (pageName === 'chat') btnIndex = 3;

        const navBtns = document.querySelectorAll('.nav-btn');
        if(navBtns[btnIndex]) navBtns[btnIndex].classList.add('active');

        if(pageName === 'mindmap' && this.pendingMindmapRoot) {
            setTimeout(() => {
                try {
                    if (!window.mm) {
                        this.els.markmapSvg.innerHTML = '';
                        window.mm = window.markmap.Markmap.create(this.els.markmapSvg, null, this.pendingMindmapRoot);
                    } else { window.mm.setData(this.pendingMindmapRoot); window.mm.fit(); }
                } catch (err) { console.warn("D3 動畫警告:", err); }
            }, 150); 
        }
    },

    toggleMode() {
        // 根據 radio 選擇切換麥克風錄音或檔案上傳模式。
        const radios = document.getElementsByName('mode');
        for (let r of radios) if (r.checked) this.currentMode = r.value;
        if (this.currentMode === 'mic') { 
            this.els.fileUploadArea.style.display = 'none'; 
            if(!this.isAgendaLocked) this.els.actionButton.textContent = '鎖定議程並開始會議'; 
        } else { 
            this.els.fileUploadArea.style.display = 'block'; 
            if(!this.isAgendaLocked) this.els.actionButton.textContent = '上傳檔案並開始分析'; 
        }
    },

    renderAgendaList() {
        // 重新繪製議程清單；若議程已被逐字稿命中，使用刪除線並可點擊跳轉。
        this.els.agendaList.innerHTML = '';
        if (this.myTopics.length === 0) { this.els.agendaList.innerHTML = '<p style="text-align:center; color:#ccc; font-size:0.9em;">無議程</p>'; return; }
        this.myTopics.forEach((topic, index) => {
            const div = document.createElement('div'); div.className = 'topic-item'; div.id = `topic-${topic}`;
            const deleteBtn = this.isAgendaLocked ? '' : `<button onclick="removeTopic(${index})" style="background:none; color:red; padding:0; font-weight:bold;">✕</button>`;
            div.innerHTML = `<span>${topic}</span> ${deleteBtn}`;
            
            if (this.topicToTranscriptId[topic]) {
                div.classList.add('done'); div.style.cursor = 'pointer'; 
                div.onclick = () => {
                    const targetEl = document.getElementById(this.topicToTranscriptId[topic]);
                    if (targetEl) { targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); targetEl.style.backgroundColor = '#ffff99'; setTimeout(() => targetEl.style.backgroundColor = 'transparent', 2000); }
                };
            }
            this.els.agendaList.appendChild(div);
        });
    },

    escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    getStatusLabel(status) {
        if (status === 'CONSENSUS') return '共識';
        if (status === 'DISPUTE') return '爭議';
        return '';
    },

    renderTranscriptEntry(entry) {
        const statusLabel = this.getStatusLabel(entry.status);
        const tag = statusLabel ? `<span class="tag ${entry.status === 'DISPUTE' ? 'tag-dispute' : 'tag-consensus'}">${statusLabel}</span>` : '';
        const topics = entry.hit_topics && entry.hit_topics.length
            ? `<span class="topic-hit">議程：${entry.hit_topics.map(t => this.escapeHtml(t)).join('、')}</span>`
            : '';
        const className = entry.status === 'DISPUTE' ? 'transcript-entry text-dispute' : 'transcript-entry';
        const imageAnalysis = entry.image_analysis ? `
            <div class="transcript-image-card">
                ${entry.image_analysis.image_url ? `<img class="transcript-image-thumb" src="${this.escapeHtml(this.resolveAssetUrl(entry.image_analysis.image_url))}" alt="${this.escapeHtml(entry.image_analysis.filename || '圖片分析')}">` : ''}
                <div class="transcript-image-body">
                    <strong>圖片分析：${this.escapeHtml(entry.image_analysis.filename || '圖片')}</strong>
                    <p>${this.escapeHtml(entry.image_analysis.description || entry.text || '').replace(/\n{3,}/g, '\n\n').replace(/\n/g, '<br>')}</p>
                </div>
            </div>
        ` : '';

        return `
            <div id="${entry.id}" class="${className}">
                <span class="transcript-time">${this.escapeHtml(entry.ts)}</span>
                <span class="transcript-main">
                    <span class="transcript-meta">${tag}${topics}</span>
                    ${entry.image_analysis ? imageAnalysis : `<span class="transcript-text">${this.escapeHtml(entry.text)}</span>`}
                </span>
            </div>
        `;
    },

    renderFullTranscript() {
        if (!this.els.fullTranscript) return;
        this.els.fullTranscript.innerHTML = this.fullTranscriptLog.map(entry => this.renderTranscriptEntry(entry)).join('');
        this.els.fullTranscript.scrollTop = this.els.fullTranscript.scrollHeight;
    },

    formatTranscriptForSave() {
        return (this.fullTranscriptLog || []).map(entry => {
            if (entry.image_analysis) {
                const image = entry.image_analysis;
                const imageLine = image.image_url ? `\n圖片：${image.image_url}` : '';
                return `${entry.ts} [圖片分析] ${image.filename || '圖片'}${imageLine}\n${image.description || entry.text || ''}`;
            }

            const tags = [];
            const statusLabel = this.getStatusLabel(entry.status);
            if (statusLabel) tags.push(statusLabel);
            if (entry.hit_topics && entry.hit_topics.length) tags.push(`議程：${entry.hit_topics.join('、')}`);
            const tagText = tags.length ? ` [${tags.join('｜')}]` : '';
            return `${entry.ts}${tagText} ${entry.text}`;
        }).join('\n');
    },

    updateTranscript(data) {
        // 接收後端辨識結果後，更新唯一的完整逐字稿，並同步議程命中狀態。
        const ts = data.ts ? data.ts.trim() : `[片段]`;
        const entry = {
            id: `transcript-${this.chunkCounter}`,
            ts,
            text: data.text || "",
            status: data.status || "NORMAL",
            hit_topics: Array.isArray(data.hit_topics) ? data.hit_topics : [],
            image_analysis: data.image_analysis || null
        };
        this.fullTranscriptLog.push(entry);

        if (data.image_analysis) {
            this.addImageAnalysis(data.image_analysis.filename, data.image_analysis.description, data.image_analysis.image_url);
        }

        if (entry.hit_topics.length > 0) {
            let shouldRenderAgenda = false;
            entry.hit_topics.forEach(t => { if (!this.topicToTranscriptId[t]) { this.topicToTranscriptId[t] = entry.id; shouldRenderAgenda = true; } });
            if (shouldRenderAgenda) this.renderAgendaList();
        }
        this.chunkCounter++; 

        this.renderFullTranscript();
        this.els.warningMsg.style.display = data.warning ? 'block' : 'none'; this.els.warningMsg.textContent = data.warning || '';
    },

    updateImageAnalysis(data) {
        // 圖片分析結果同時顯示在即時紀錄，也寫入 imageAnalysisLog 供摘要與儲存使用。
        this.addImageAnalysis(data.filename || '圖片', data.description || '', data.image_url || '');
        this.els.btnUploadImage.disabled = false; this.els.btnUploadImage.textContent = "分析圖片"; 
        this.els.imgStatus.textContent = "✅ 分析完成"; this.els.imageInput.value = "";
    },

    addImageAnalysis(filename, description, imageUrl) {
        // 用完整 entry 去重，避免同一張圖片透過 HTTP 與 WebSocket 流程被加入兩次。
        if (!description) return;
        const entry = {
            filename: filename || '圖片',
            description,
            image_url: imageUrl || ''
        };
        const key = `${entry.filename}\n${entry.description}\n${entry.image_url}`;
        const exists = this.imageAnalysisLog.some(item => {
            if (typeof item === 'string') return item === key || item.includes(entry.description);
            return `${item.filename}\n${item.description}\n${item.image_url}` === key;
        });
        if (!exists) {
            this.imageAnalysisLog.push(entry);
        }
    },

    getImageAnalysisText() {
        // 優先使用獨立圖片分析紀錄；若沒有，再從舊版逐字稿標籤中回推。
        const fromLog = (this.imageAnalysisLog || []).map(item => {
            if (typeof item === 'string') return item;
            const imageLine = item.image_url ? `圖片：${item.image_url}\n` : '';
            return `[圖片分析] ${item.filename || '圖片'}\n${imageLine}${item.description || ''}`;
        }).join('\n\n').trim();
        if (fromLog) return fromLog;

        return (this.fullTranscriptLog || [])
            .map(entry => String(entry.text || entry).trim())
            .filter(line => line.includes('圖片分析'))
            .filter((line, index, arr) => arr.indexOf(line) === index)
            .join('\n');
    },

    renderImageAnalysisResult() {
        // 摘要頁的圖片分析區塊只有在有內容時顯示，避免空白區域干擾閱讀。
        if (!this.els.imageAnalysisResultSection || !this.els.imageAnalysisResultBox) return "";

        const imageAnalysisText = this.getImageAnalysisText();
        if (imageAnalysisText) {
            this.els.imageAnalysisResultSection.style.display = 'block';
            this.els.imageAnalysisResultBox.innerHTML = this.renderImageAnalysisItems();
        } else {
            this.els.imageAnalysisResultSection.style.display = 'none';
            this.els.imageAnalysisResultBox.innerHTML = '';
        }

        return imageAnalysisText;
    },

    renderImageAnalysisItems() {
        const items = this.getImageAnalysisItems();
        if (!items.length) return '';

        return items.map(item => `
            <div class="image-analysis-card">
                ${item.image_url ? `<img class="image-analysis-thumb" src="${this.escapeHtml(this.resolveAssetUrl(item.image_url))}" alt="${this.escapeHtml(item.filename)}">` : ''}
                <div class="image-analysis-body">
                    <strong>${this.escapeHtml(item.filename || '圖片分析')}</strong>
                    <p>${this.escapeHtml(item.description || '').replace(/\n{3,}/g, '\n\n').replace(/\n/g, '<br>')}</p>
                </div>
            </div>
        `).join('');
    },

    getImageAnalysisItems() {
        const fromLog = (this.imageAnalysisLog || []).map(item => {
            if (typeof item !== 'string') return item;
            return { filename: '圖片分析', description: item, image_url: '' };
        });
        if (fromLog.length) return fromLog;

        return (this.fullTranscriptLog || [])
            .filter(entry => entry.image_analysis)
            .map(entry => entry.image_analysis);
    },

    resolveAssetUrl(url) {
        if (!url) return '';
        if (/^(https?:|data:|blob:)/.test(url)) return url;
        const baseUrl = typeof API_BASE_URL === 'string' ? API_BASE_URL : '';
        return `${baseUrl}/${String(url).replace(/^\/+/, '')}`;
    },

    getSummaryFileName() {
        const topic = typeof currentMeetingTopic === 'string' ? currentMeetingTopic.trim() : '';
        const meetingId = typeof currentMeetingId === 'string' ? currentMeetingId.trim() : '';
        return topic || (meetingId ? `meeting_${meetingId}_summary` : 'meeting_summary');
    },

    getSummaryExportOptions() {
        const summaryHtml = this.els.aiSummaryBox ? this.els.aiSummaryBox.innerHTML : '';
        const imageAnalysisHtml = this.els.imageAnalysisResultSection && this.els.imageAnalysisResultSection.style.display !== 'none'
            ? (this.els.imageAnalysisResultBox ? this.els.imageAnalysisResultBox.innerHTML : '')
            : '';

        return {
            title: this.getSummaryFileName(),
            baseFileName: this.getSummaryFileName(),
            summaryHtml,
            imageAnalysisHtml
        };
    },

    updateInterimSummary(data) {
        // 即時摘要採最新在上的方式追加，方便使用者看到最近一段會議重點。
        if(!this.els.interimSummaryBox) return;
        const now = new Date(); const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        const newEntry = `<div style="margin-bottom: 10px; border-bottom: 1px dashed #ccc; padding-bottom: 5px;"><strong>[${timeStr} 更新]</strong><br>${data.replace(/\n/g, '<br>')}</div>`;
        if(this.els.interimSummaryBox.innerHTML.includes("會議開始後")) this.els.interimSummaryBox.innerHTML = '';
        this.els.interimSummaryBox.innerHTML = newEntry + this.els.interimSummaryBox.innerHTML;
    },

    renderSummaryAndMindmap(res, audioSourceUrl) {
        // 總結完成後一次更新摘要、圖片分析、下一次議程草稿、心智圖與音訊播放控制。
        const imageAnalysisText = this.renderImageAnalysisResult();

        if (res && res.summary) {
            this.els.aiSummaryBox.innerHTML = res.summary; this.currentSummaryData = res.summary;
            if (imageAnalysisText) {
                this.currentSummaryData = `${res.summary}\n\n## 圖片分析結果\n${imageAnalysisText}`;
            }
            const clean = res.summary.replace(/<[^>]+>/g, '');
            if (clean.includes("二、尚未解決議題")) {
                const parts = clean.split("二、尚未解決議題");
                if (parts.length > 1) this.els.nextAgendaPreview.value = parts[1].split("三、")[0].trim();
            }
        } else { this.els.aiSummaryBox.innerHTML = "<p style='color:red;'>⚠️ AI 未回傳有效摘要內容。</p>"; }

        if (this.els.mindmapAudioPlayer && audioSourceUrl) {
            this.els.mindmapAudioPlayer.src = audioSourceUrl; this.els.mindmapAudioPlayer.style.display = 'block'; 
            this.els.mindmapAudioPlayer.ontimeupdate = () => {
                if (this.targetEndTime !== null && this.els.mindmapAudioPlayer.currentTime >= this.targetEndTime) {
                    this.els.mindmapAudioPlayer.pause(); this.targetEndTime = null;
                }
            };
        }

        if (res && res.mindmap && window.markmap) {
            let rawMindmap = res.mindmap.replace(/```markdown/g, '').replace(/```/g, '').trim();
            rawMindmap = rawMindmap.replace(/\[\s*\]/g, "[00:00]"); 
            
            rawMindmap = rawMindmap.replace(/【第二部分：結構化心智圖】/g, '').trim();
            if (!rawMindmap.startsWith('#')) rawMindmap = '# 會議心智圖\n' + rawMindmap; 

            try {
                const transformer = new window.markmap.Transformer();
                const { root } = transformer.transform(rawMindmap);
                this.pendingMindmapRoot = root;
                this.mindmapTimestamps = [];
                const extractTimes = (node) => {
                    if(!node) return;
                    if(node.content) {
                        const m = node.content.match(/\[(\d+):(\d+)\]/);
                        if(m) {
                            const sec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
                            if(!this.mindmapTimestamps.includes(sec)) this.mindmapTimestamps.push(sec);
                        }
                    }
                    if(node.children) node.children.forEach(extractTimes);
                };
                extractTimes(root);
                this.mindmapTimestamps.sort((a, b) => a - b);
                
                if (document.getElementById('page-mindmap').classList.contains('active')) {
                    if (!window.mm) { this.els.markmapSvg.innerHTML = ''; window.mm = window.markmap.Markmap.create(this.els.markmapSvg, null, this.pendingMindmapRoot); 
                    } else { window.mm.setData(this.pendingMindmapRoot); window.mm.fit(); }
                }
            } catch (err) { console.error("心智圖渲染失敗", err); }
        } else if (res && res.mindmap) { this.els.markmapSvg.innerHTML = '<text x="20" y="40" fill="red">⚠️ 心智圖套件載入失敗</text>'; }

        this.els.downloadBtn.disabled = false;
        if (this.els.downloadWordBtn) this.els.downloadWordBtn.disabled = false;
        if (this.els.downloadPdfBtn) this.els.downloadPdfBtn.disabled = false;
        this.els.copyBtn.disabled = false;
        this.els.statusText.textContent = '狀態：報告已生成！請切換分頁查看。'; 
        this.els.actionButton.textContent = '會議已結束 (點擊切換查看結果)';
        this.els.actionButton.className = 'btn-success'; 
        this.els.actionButton.onclick = () => this.switchPage('summary'); 
        this.els.actionButton.disabled = false;
    },

    handleMindmapClick(e) {
        // 點擊 markmap 節點時若文字內含 [MM:SS]，就跳到對應音訊時間播放。
        const nodeGroup = e.target.closest('.markmap-node');
        if (nodeGroup && window.d3) {
            const datum = window.d3.select(nodeGroup).datum();
            if (datum && datum.data && datum.data.content) {
                const timeMatch = datum.data.content.match(/\[(\d+):(\d+)\]/);
                if (timeMatch && this.els.mindmapAudioPlayer) {
                    const totalSeconds = (parseInt(timeMatch[1], 10) * 60) + parseInt(timeMatch[2], 10);
                    const currentIndex = this.mindmapTimestamps.indexOf(totalSeconds);
                    this.targetEndTime = (currentIndex !== -1 && currentIndex < this.mindmapTimestamps.length - 1) ? this.mindmapTimestamps[currentIndex + 1] : null;
                    let jumpTime = totalSeconds - 2; 
                    this.els.mindmapAudioPlayer.currentTime = jumpTime < 0 ? 0 : jumpTime;
                    this.els.mindmapAudioPlayer.play();
                }
            }
        }
    },

    resetMeetingUI() {
        // 會議開始前清掉上一輪狀態，並鎖定議程輸入，確保逐字稿命中結果穩定。
        this.els.inputArea.style.display = 'none';
        this.els.aiSummaryBox.innerHTML = '<div style="text-align:center; margin-top:50px; color:#888;">生成中...</div>';
        if (this.els.imageAnalysisResultSection) this.els.imageAnalysisResultSection.style.display = 'none';
        if (this.els.imageAnalysisResultBox) this.els.imageAnalysisResultBox.textContent = '';
        this.currentSummaryData = '';
        if (this.els.downloadBtn) this.els.downloadBtn.disabled = true;
        if (this.els.downloadWordBtn) this.els.downloadWordBtn.disabled = true;
        if (this.els.downloadPdfBtn) this.els.downloadPdfBtn.disabled = true;
        if (this.els.copyBtn) this.els.copyBtn.disabled = true;
        this.els.markmapSvg.innerHTML = ''; this.els.nextAgendaPreview.value = ''; this.pendingMindmapRoot = null;
        if (this.els.liveTranscript) this.els.liveTranscript.innerHTML = "";
        this.els.fullTranscript.innerHTML = ""; 
        this.chunkCounter = 0; this.fullTranscriptLog = []; this.imageAnalysisLog = []; this.topicToTranscriptId = {}; 
        this.meetingStartTime = Date.now(); this.isAgendaLocked = true;
        this.els.actionButton.disabled = true; this.els.statusText.textContent = '狀態：初始化中...';
    }
};
