// ==UserScript==
// @name        Gigazine img loader
// @namespace   https://github.com/akku1139/userscripts
// @match       https://gigazine.net/news/*
// @grant       none
// @version     1.0.1
// @author      akku
// @description 5/8/2024, 12:49:06 AM
// ==/UserScript==

document.querySelectorAll("img.lazyload").forEach((tag) =>
  tag.src = tag.getAttribute("data-src")
);
