// ==UserScript==
// @name        絶対新しいタブで開かない
// @namespace   https://github.com/akku1139/userscripts/blob/main/never_newtab.user.js
// @match       *://*/*
// @grant       none
// @version     1.0.1
// @author      -
// @description 12/7/2023, 10:44:38 PM
// @license     Unlicense
// ==/UserScript==

window.open = function(url, target="", windowFeatures="") {
  location.href = url;
}

Array.from(document.getElementsByTagName("a")).forEach(e => {
  if(/_blank|_new|blank|new/.test(e.getAttribute("target"))) {
      e.removeAttribute("target");
  }
});
