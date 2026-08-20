// ==UserScript==
// @name         One-Click Web Highlighter
// @namespace    one-click-highlighter
// @version      1.0
// @description  Highlight selected text with one click and keep it after reopening the page
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'oneClickHighlights_v1';
    const HIGHLIGHT_COLOR = '#fff176';

    function getPageKey() {
        return location.origin + location.pathname + location.search;
    }

    function loadHighlights() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        } catch {
            return {};
        }
    }

    function saveHighlights(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function getTextNodes(root = document.body) {
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;

                    if (
                        parent.closest(
                            'script,style,noscript,textarea,input,select,button,[contenteditable="true"]'
                        )
                    ) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    if (!node.nodeValue.trim()) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const nodes = [];
        let node;

        while ((node = walker.nextNode())) {
            nodes.push(node);
        }

        return nodes;
    }

    function findText(text, occurrence = 0) {
        const nodes = getTextNodes();
        let count = 0;

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const index = node.nodeValue.indexOf(text);

            if (index !== -1) {
                if (count === occurrence) {
                    return {
                        node,
                        index
                    };
                }
                count++;
            }
        }

        return null;
    }

    function highlightText(text) {
        if (!text.trim()) return;

        const data = loadHighlights();
        const key = getPageKey();

        if (!data[key]) data[key] = [];

        if (data[key].some(x => x.text === text)) {
            return;
        }

        data[key].push({
            text: text,
            occurrence: data[key].filter(x => x.text === text).length
        });

        saveHighlights(data);

        applyHighlight(text);
    }

    function applyHighlight(text, occurrence = 0) {
        const result = findText(text, occurrence);

        if (!result) return;

        const { node, index } = result;

        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + text.length);

        const mark = document.createElement('mark');

        mark.className = 'one-click-highlight';
        mark.style.backgroundColor = HIGHLIGHT_COLOR;
        mark.style.color = 'inherit';
        mark.style.borderRadius = '3px';
        mark.style.padding = '0 2px';

        try {
            range.surroundContents(mark);
        } catch {
            const fragment = range.extractContents();
            mark.appendChild(fragment);
            range.insertNode(mark);
        }
    }

    function restoreHighlights() {
        const data = loadHighlights();
        const key = getPageKey();

        if (!data[key]) return;

        setTimeout(() => {
            data[key].forEach(item => {
                applyHighlight(item.text, item.occurrence || 0);
            });
        }, 500);
    }

    function createButton() {
        const button = document.createElement('button');

        button.id = 'one-click-highlight-button';
        button.textContent = '🟨';
        button.title = 'Highlight selected text';

        Object.assign(button.style, {
            position: 'fixed',
            zIndex: '2147483647',
            display: 'none',
            width: '48px',
            height: '48px',
            border: 'none',
            borderRadius: '50%',
            background: '#222',
            color: '#fff',
            fontSize: '24px',
            boxShadow: '0 4px 15px rgba(0,0,0,.35)',
            cursor: 'pointer',
            alignItems: 'center',
            justifyContent: 'center'
        });

        document.body.appendChild(button);

        let selectedText = '';

        document.addEventListener('selectionchange', () => {
            const selection = window.getSelection();

            if (!selection || selection.isCollapsed) {
                button.style.display = 'none';
                return;
            }

            const text = selection.toString().trim();

            if (!text) {
                button.style.display = 'none';
                return;
            }

            selectedText = text;

            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            let left = rect.left + rect.width / 2 - 24;
            let top = rect.top - 58;

            if (top < 5) {
                top = rect.bottom + 10;
            }

            left = Math.max(5, Math.min(left, window.innerWidth - 53));

            button.style.left = left + 'px';
            button.style.top = top + 'px';
            button.style.display = 'flex';
        });

        button.addEventListener('mousedown', e => {
            e.preventDefault();
        });

        button.addEventListener('touchstart', e => {
            e.preventDefault();
        }, { passive: false });

        button.addEventListener('click', () => {
            if (!selectedText) return;

            highlightText(selectedText);

            window.getSelection()?.removeAllRanges();

            button.style.display = 'none';
            selectedText = '';
        });
    }

    function start() {
        if (!document.body) {
            setTimeout(start, 100);
            return;
        }

        createButton();
        restoreHighlights();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
