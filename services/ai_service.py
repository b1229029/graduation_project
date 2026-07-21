"""AI 模型呼叫與摘要產生服務。

本檔集中管理 OpenAI-compatible chat/vision API 的請求格式。listener.py 會
呼叫這些函式來完成圖片分析、短摘要、會議總結、心智圖文字與即時摘要。
所有函式都回傳純文字或 JSON 字串，方便 WebSocket 層直接傳回前端。
"""

import time
import requests
import json
import os
import re
from dotenv import load_dotenv

load_dotenv()

# ==========================================
# API 相關設定
# ==========================================
NEW_API_KEY = os.getenv("AI_SERVICE_API_KEY")
BASE_URL = os.getenv("BASE_URL") 
CHAT_MODEL = "gpt-oss:20b"
CHAT_ENDPOINT = f"{BASE_URL}/chat/completions"

# ==========================================
# 圖片分析功能
# ==========================================
def analyze_image_content(base64_image, filename="unknown.jpg"):
    """分析 base64 圖片並回傳文字描述。

    base64_image 可是純 base64，也可是 data:image/... URL。函式會補齊
    data URL 前綴後呼叫 vision model，讓會議中的截圖、白板或投影片可以
    轉成後續摘要與問答能使用的文字。
    """
    USE_MOCK_VISION = False 
    if USE_MOCK_VISION:
        time.sleep(1.5)
        return f"(系統暫存：已收到圖片 '{filename}'。目前模型尚未啟用視覺辨識，此為佔位描述。未來此處將顯示圖片的詳細分析。)"
    else:
        headers = {
            "Content-Type": "application/json", 
            "Authorization": f"Bearer {NEW_API_KEY}"
        }
        
        if not base64_image.startswith("data:image"):
            base64_image = f"data:image/png;base64,{base64_image}"

        payload = {
            "model": "gpt-5.4-mini",
            "messages": [
                {
                    "role": "user", 
                    "content": [
                        {"type": "text", "text": "請詳細描述這張圖片的內容"}, 
                        {"type": "image_url", "image_url": {"url": base64_image}}
                    ]
                }
            ], 
            "max_completion_tokens": 500
        }
        try:
            response = requests.post(CHAT_ENDPOINT, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            return response.json()['choices'][0]['message']['content']
        except Exception as e:
            return f"(圖片分析失敗 - {str(e)})"

# ==========================================
# 長文本分段總結
# ==========================================
def summarize_chunk(chunk_text):
    """將一段逐字稿壓縮成短摘要。

    主要用於長會議中間摘要或分段整理，讓後續生成總摘要時不必把所有原文
    一次塞進模型。
    """
    prompt = f"請幫我用 50 到 100 字以內的繁體中文，總結以下對話內容的重點。\n若這段內容無實質重點，請回覆：「無明顯重點」。\n【對話片段】\n{chunk_text}"
    headers = {
        "Content-Type": "application/json", 
        "Authorization": f"Bearer {NEW_API_KEY}"
    }
    payload = {
        "model": CHAT_MODEL, 
        "messages": [{"role": "user", "content": prompt}], 
        "max_tokens": 800, 
        "temperature": 0.2, 
        "stream": False 
    }
    try:
        res = requests.post(CHAT_ENDPOINT, headers=headers, json=payload, timeout=60)
        res.raise_for_status()
        return res.json()['choices'][0]['message']['content'].strip()
    except Exception as e:
        return "（此段落總結失敗）"

# ==========================================
# 生成最終會議紀錄與心智圖
# ==========================================
def _has_mindmap_content(mindmap_text):
    """A heading alone is not a usable mind map."""
    return bool(re.search(r"(?m)^\s*[-*+]\s+\S+", mindmap_text or ""))


def _generate_mindmap_only(compiled_context, summary_text):
    """Retry mind-map generation separately when the combined output omitted it."""
    context = compiled_context or ""
    if len(context) > 16000:
        context = context[:8000] + "\n……（中段省略）……\n" + context[-8000:]

    prompt = f"""
請根據會議總結與逐字稿，只輸出 Markdown 心智圖，不要輸出解釋、前言或程式碼圍欄。
第一行必須是「# 本次會議核心主題」，後續至少包含 3 個「- 」項目。
每個項目末尾必須有 [MM:SS]；找不到時間時使用 [00:00]。不得虛構會議未提及的內容。

【會議總結】
{summary_text}

【逐字稿】
{context}
"""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {NEW_API_KEY}"
    }
    payload = {
        "model": CHAT_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 1800,
        "stream": False
    }

    for _ in range(2):
        try:
            response = requests.post(CHAT_ENDPOINT, headers=headers, json=payload, timeout=300)
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"].strip()
            content = content.replace("```markdown", "").replace("```", "").strip()
            if _has_mindmap_content(content):
                return content if content.startswith("#") else "# 本次會議核心主題\n" + content
        except Exception:
            continue

    return "# 心智圖產生失敗\n- 模型未回傳有效內容，請稍後重新產生 [00:00]"


def generate_meeting_summary(compiled_context, undiscussed_list=None, template_type="general", retry_count=0, participants_str=""):
    """依會議上下文產生摘要與心智圖 Markdown。

    compiled_context 會包含逐字稿、即時摘要與圖片分析結果；undiscussed_list
    會提醒模型哪些議程尚未被討論。函式回傳 JSON 字串，格式包含 summary
    與 mindmap，前端會分別渲染到摘要頁與 markmap 心智圖。
    """
    if not compiled_context or len(compiled_context) < 10: 
        return json.dumps({"summary": "會議內容過短，無法生成總結。", "mindmap": ""})

    if undiscussed_list is None: 
        undiscussed_list = []
    
    undiscussed_str = "、".join(undiscussed_list) if undiscussed_list else "無"

    templates = {
        "general": f"一、會議結論：\n二、尚未解決議題：(系統偵測「{undiscussed_str}」可能未討論)\n三、待辦事項（事項｜負責人｜逐字稿依據）：\n四、討論爭議點：\n"
    }
    selected_structure = templates.get(template_type, templates["general"])

    participant_hint = f"\n【參與者名單】：{participants_str}。此名單只用於校正逐字稿中的相近人名，不代表這些人都有待辦，也不能作為指派負責人的依據。" if participants_str else ""
    image_hint = "\n【圖片整合強制指示】：若下方會議素材中包含「[會議補充資訊]」或「[圖片分析]」的文字，請你務必將該圖片的內容與這場會議的主題結合，並且『清楚地寫進總結報告與心智圖中』，絕對不可忽略！"
    prompt = f"""
請嚴格扮演專業的會議秘書。根據以下「會議素材」，產出完整的會議紀錄與心智圖。
{participant_hint}
{image_hint}  # 🚀 把圖片提示放進這裡

💡【情境通融指示】：若素材是故事、新聞或單向演講，可以合理歸納內容；但不得虛構待辦事項或負責人。

【待辦事項與負責人防臆測規則】：
1. 只有逐字稿明確出現指派語意（例如「小王負責」、「請小王處理」、「這件事交給小王」）時，才能填入該負責人。
2. 僅提到某人的姓名、該人發言、參與者名單中有此人，均不代表他是負責人。
3. 若有待辦但沒有明確指派，負責人一律寫「未指定」；若連待辦都未明確形成，寫「無明確待辦」。
4. 每項待辦都必須附上逐字稿中的原句或最接近的短句作為「逐字稿依據」；找不到依據就不得建立該待辦或指派姓名。
5. 不得依職稱、專長、對話脈絡或常識猜測負責人，也不得把圖片中出現的人名自動視為負責人。

⚠️【絕對格式要求】：你必須完全依照下方格式輸出，絕不可省略任何項目，且必須輸出「===MINDMAP_START===」作為分隔線！

【第一部分：會議重點紀錄】
{selected_structure}

===MINDMAP_START===
# 本次會議核心主題
- 關鍵議題一 [00:10]
  - 細節說明 [00:15]
- 關鍵議題二 [02:30]
  - 決議事項 [02:55]

💡【心智圖嚴格指令，違者嚴懲】：
1. 不准輸出「第二部分：結構化心智圖」這幾個字！請直接從「# 本次會議核心主題」開始寫起。
2. 每一個項目（包含父節點與子節點）的最後面，都「必須」加上時間標籤 [MM:SS]！若真的找不到對應時間，請強制標註 [00:00]。絕對不允許出現沒有時間標籤的節點！

以下是【會議素材】：
{compiled_context}
"""

    headers = {
        "Content-Type": "application/json", 
        "Authorization": f"Bearer {NEW_API_KEY}"
    }
    
    payload = { 
        "model": CHAT_MODEL, 
        "messages": [{"role": "user", "content": prompt}], 
        "temperature": 0.2 + (0.1 * retry_count), 
        "max_tokens": 4000, 
        "stream": False 
    }

    try:
        response = requests.post(CHAT_ENDPOINT, headers=headers, json=payload, timeout=600)
        if response.status_code != 200: 
            return json.dumps({"error": f"伺服器錯誤 ({response.status_code})"})
        
        response.raise_for_status()
        raw_content = response.json()['choices'][0]['message']['content'].strip()
        
        if not raw_content:
            if retry_count < 2: 
                print(f"⚠️ 收到空白內容，啟動第 {retry_count + 1} 次重試...")
                return generate_meeting_summary(
                    compiled_context,
                    undiscussed_list,
                    template_type,
                    retry_count + 1,
                    participants_str
                )
            else: 
                return json.dumps({"error": "⚠️ API 連續回傳空白內容，請確認會議長度或稍後再試。"})

        summary_part = raw_content
        mindmap_part = ""
        
        mindmap_split = re.split(r"={2,}\s*MINDMAP_START\s*={2,}", raw_content, maxsplit=1)
        if len(mindmap_split) == 2:
            parts = mindmap_split
            summary_part = parts[0].strip()
            mindmap_part = parts[1].strip()
        elif "【第二部分：結構化心智圖】" in raw_content:
            parts = raw_content.split("【第二部分：結構化心智圖】")
            summary_part = parts[0].strip()
            mindmap_part = parts[1].strip()
        elif "**第二部分" in raw_content:
            parts = raw_content.split("**第二部分")
            summary_part = parts[0].strip()
            mindmap_part = parts[1].strip()

        noises_to_remove = [
            "【第二部分：結構化心智圖】", 
            "**【第二部分：結構化心智圖】**", 
            "**第二部分：結構化心智圖**", 
            "**第二部分**", 
            "第二部分：結構化心智圖", 
            "```markdown", 
            "```"
        ]
        for noise in noises_to_remove:
            mindmap_part = mindmap_part.replace(noise, "")
        
        mindmap_part = mindmap_part.strip()

        # Some models omit the delimiter or stop after a heading. Do not treat
        # that as success; make a smaller, dedicated request for the mind map.
        if not _has_mindmap_content(mindmap_part):
            mindmap_part = _generate_mindmap_only(compiled_context, summary_part)
        elif not mindmap_part.startswith("#"):
            mindmap_part = "# 會議核心總結\n" + mindmap_part
                
        return json.dumps({"summary": summary_part, "mindmap": mindmap_part})
    except Exception as e:
        return json.dumps({"error": f"生成錯誤: {str(e)}"})

# ==========================================
# 每分鐘即時重點 (Interim Summary)
# ==========================================
def generate_interim_summary(recent_transcript):
    """替最近新增的逐字稿產生即時短摘要。

    前端錄音時會定期要求 interim summary，讓使用者不用等到會議結束才看見
    AI 整理結果。內容太短時直接回傳提示文字，避免浪費 API 請求。
    """
    if len(recent_transcript) < 30:
        return "目前內容過少，暫無重點。"
    
    prompt = f"請幫我用 50 字以內的繁體中文，條列式總結以下「最新這3分鐘」的對話內容。\n若無實質重點，請回覆：「無新增明顯重點」。\n【對話片段】\n{recent_transcript}"
    headers = {
        "Content-Type": "application/json", 
        "Authorization": f"Bearer {NEW_API_KEY}"
    }
    payload = { 
        "model": CHAT_MODEL, 
        "messages": [{"role": "user", "content": prompt}], 
        "temperature": 0.3, 
        "stream": False 
    }
    
    try:
        res = requests.post(CHAT_ENDPOINT, headers=headers, json=payload, timeout=60)
        if res.status_code != 200: 
            return f"(伺服器錯誤 {res.status_code})"
        res.raise_for_status()
        content = res.json()['choices'][0]['message']['content'].strip()
        return content if content else "（AI 未回傳內容）"
    except Exception as e:
        return f"生成失敗: {str(e)}"
