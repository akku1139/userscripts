// ==UserScript==
// @name        GitHub Advisory Textarea Resize Fix
// @namespace   https://github.com/akku1139/userscripts/blob/main/GitHub-Advisory-Textarea-Resize-Fix.user.js
// @version     1.0.1
//
// @match       https://github.com/*
// @grant       GM_addStyle
//
// @author      akku
// @description
// @run-at       document-idle
// ==/UserScript==

const SELECTOR = 'textarea.issue-form-textarea, textarea#repository_advisory_description_form_summary';

function patch(ta) {
  if (ta.dataset.resizeFixApplied === '1') return;
  ta.dataset.resizeFixApplied = '1';

  // ネイティブリサイズは style.height を「!important なし」で書き込むので、
  // それを検知して !important 付きに直してあげる。
  new MutationObserver(() => {
    const h = ta.style.getPropertyValue('height');
    const p = ta.style.getPropertyPriority('height');
    if (h && p !== 'important') {
      ta.style.setProperty('height', h, 'important');
    }
  }).observe(ta, { attributes: true, attributeFilter: ['style'] });
}

function scan() {
  document.querySelectorAll(SELECTOR).forEach(patch);
}

// documentElement 全体を監視すると頻繁に発火するので rAF で間引く
let scheduled = false;
function scheduleScan() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    scan();
  });
}

scan();
document.addEventListener('turbo:load', scan);
document.addEventListener('pjax:end', scan);
new MutationObserver(scheduleScan).observe(document.documentElement, {
  childList: true,
  subtree: true,
});

GM_addStyle(`
html body .issue-form-textarea {
  min-width: 100% !important;
}
`)
