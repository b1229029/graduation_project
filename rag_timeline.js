(function (root) {
    'use strict';

    // 同時支援 [MM:SS] 與 MM:SS；避免把更長的數字/時間字串的一部分當成時間。
    const TIMESTAMP_PATTERN = /\[(\d+):([0-5]\d)\]|(?<![\d:])(\d+):([0-5]\d)(?![\d:])/g;

    function linkify(container, onActivate) {
        if (!container || typeof onActivate !== 'function') return;

        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) {
            const node = walker.currentNode;
            const parentTag = node.parentElement ? node.parentElement.tagName : '';
            if (!['A', 'BUTTON', 'CODE', 'PRE'].includes(parentTag) && TIMESTAMP_PATTERN.test(node.nodeValue || '')) {
                textNodes.push(node);
            }
            TIMESTAMP_PATTERN.lastIndex = 0;
        }

        textNodes.forEach(node => {
            const text = node.nodeValue || '';
            const fragment = document.createDocumentFragment();
            let cursor = 0;
            let match;
            TIMESTAMP_PATTERN.lastIndex = 0;

            while ((match = TIMESTAMP_PATTERN.exec(text)) !== null) {
                if (match.index > cursor) {
                    fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
                }

                const minutes = match[1] !== undefined ? match[1] : match[3];
                const seconds = match[2] !== undefined ? match[2] : match[4];
                const totalSeconds = Number(minutes) * 60 + Number(seconds);
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'rag-time-link';
                button.textContent = match[0];
                button.title = `跳到音檔 ${match[0]}`;
                button.setAttribute('aria-label', `跳到音檔 ${match[0]}`);
                button.addEventListener('click', () => onActivate(totalSeconds));
                fragment.appendChild(button);
                cursor = TIMESTAMP_PATTERN.lastIndex;
            }

            if (cursor < text.length) {
                fragment.appendChild(document.createTextNode(text.slice(cursor)));
            }
            node.replaceWith(fragment);
        });
    }

    function seekAndPlay(player, totalSeconds, leadSeconds = 2) {
        if (!player || !Number.isFinite(totalSeconds)) return Promise.resolve(false);
        const target = Math.max(0, totalSeconds - leadSeconds);

        const startPlayback = () => {
            try {
                if (Number.isFinite(player.duration) && target > player.duration) return false;
                player.currentTime = target;
                const playResult = player.play();
                if (playResult && typeof playResult.catch === 'function') {
                    playResult.catch(error => console.warn('音檔播放失敗：', error));
                }
                return true;
            } catch (error) {
                console.warn('音檔跳轉失敗：', error);
                return false;
            }
        };

        if (player.readyState >= 1) {
            return Promise.resolve(startPlayback());
        }

        return new Promise(resolve => {
            const onLoaded = () => resolve(startPlayback());
            const onError = () => resolve(false);
            player.addEventListener('loadedmetadata', onLoaded, { once: true });
            player.addEventListener('error', onError, { once: true });
            player.load();
        });
    }

    root.RagTimeline = { linkify, seekAndPlay };
})(typeof window === 'undefined' ? globalThis : window);
