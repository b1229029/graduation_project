"""逐字稿時間戳 [MM:SS] 的解析與校正工具。

逐字稿每一行都以 [MM:SS] 開頭。長會議會先分段摘要再生成心智圖，
模型在這個過程中可能抄錯或自行編造時間；這裡提供的函式讓程式端
可以算出每段的真實時間範圍，並把模型輸出的時間校正回逐字稿中
真實存在的值，確保點擊心智圖節點時一定跳到真的有人說話的位置。
"""

import bisect
import re

TIMESTAMP_PATTERN = re.compile(r"\[(\d{1,3}):(\d{1,2})\]")


def to_seconds(minutes, seconds):
    """把 MM、SS 字串或數字轉成總秒數。"""
    return int(minutes) * 60 + int(seconds)


def format_timestamp(total_seconds):
    """把總秒數格式化成與逐字稿相同的 MM:SS（不含中括號）。"""
    m, s = divmod(int(total_seconds), 60)
    return f"{m:02d}:{s:02d}"


def extract_timestamps(text):
    """取出文字中所有 [MM:SS]，回傳排序且不重複的秒數清單。"""
    return sorted({to_seconds(m, s) for m, s in TIMESTAMP_PATTERN.findall(text or "")})


def format_time_range(text):
    """回傳文字涵蓋的時間範圍，例如「02:05–04:12」；沒有時間戳時回傳空字串。"""
    stamps = extract_timestamps(text)
    if not stamps:
        return ""
    return f"{format_timestamp(stamps[0])}–{format_timestamp(stamps[-1])}"


def snap_timestamps(text, valid_seconds):
    """把文字中每個 [MM:SS] 換成 valid_seconds 裡最接近的真實時間。

    已存在於 valid_seconds 的時間會保留（只統一格式）；不存在的則改成
    最接近的那一個。valid_seconds 為空時不做任何修改。
    """
    if not text or not valid_seconds:
        return text

    valid = sorted(set(valid_seconds))

    def replace(match):
        target = to_seconds(match.group(1), match.group(2))
        i = bisect.bisect_left(valid, target)
        candidates = valid[max(i - 1, 0):i + 1]
        nearest = min(candidates, key=lambda v: abs(v - target))
        return f"[{format_timestamp(nearest)}]"

    return TIMESTAMP_PATTERN.sub(replace, text)
