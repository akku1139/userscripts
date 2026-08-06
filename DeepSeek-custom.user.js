// ==UserScript==
// @name        DeepSeek custom
// @namespace   Violentmonkey Scripts
// @version     1.0.0
// @match       https://chat.deepseek.com/*
// @grant       GM_addStyle
//
// @author      akku
// @description
// ==/UserScript==

// ユーザーの入力の最大長さを調整
GM_addStyle(`
/*
.ds-message {
*/
.fbb737a4 {
  max-height: 300px;
  overflow: scroll;
}
`);

// コードブロック折りたたみ
GM_addStyle(`
  /* ヘッダーをクリック可能に */
  .md-code-block > .md-code-block-banner-wrap {
    cursor: pointer;
    user-select: none;
  }

  /* 開閉アイコン */
  .code-toggle-icon {
    display: inline-block;
    margin-right: 6px;
    font-size: 12px;
    line-height: 1;
    transition: transform 0.2s;
    vertical-align: middle;
  }

  /* 折りたたみ時にアイコンを回転（▼→▶） */
  .md-code-block.collapsed .code-toggle-icon {
    transform: rotate(-90deg);
  }

  /* 折りたたみ時はコードを非表示 */
  .md-code-block.collapsed > pre {
    display: none !important;
  }

  /* 折りたたみ時の下のSVGも隠す（お好みで） */
  .md-code-block.collapsed > svg {
    display: none !important;
  }
`);

function setupBlock(block) {
  // 既に処理済みならスキップ
  if (block.dataset.toggleReady) return;
  block.dataset.toggleReady = 'true';

  // ヘッダー内のアイコン設置場所（言語ラベルがある div._121d384）を探す
  const container = block.querySelector(':scope .md-code-block-banner ._121d384');
  if (!container) return;

  // アイコンを先頭に追加（なければ）
  if (!container.querySelector(':scope > .code-toggle-icon')) {
    const icon = document.createElement('span');
    icon.className = 'code-toggle-icon';
    icon.textContent = '▼';
    container.prepend(icon);
  }

  // ヘッダー全体のクリックで開閉（ボタンクリックは除外）
  const bannerWrap = block.querySelector(':scope > .md-code-block-banner-wrap');
  if (!bannerWrap) return;

  bannerWrap.addEventListener('click', (e) => {
    if (e.target.closest('.ds-button')) return;
    block.classList.toggle('collapsed');
  });
}

function initCodeBlocks() {
  document.querySelectorAll('.md-code-block').forEach(setupBlock);
}

// 初回実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCodeBlocks);
} else {
  initCodeBlocks();
}

// 動的追加を監視
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.matches?.('.md-code-block')) setupBlock(node);
      node.querySelectorAll?.('.md-code-block').forEach(setupBlock);
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });
