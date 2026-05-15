// ==UserScript==
// @name        Gigazine img loader
// @namespace   Violentmonkey Scripts
// @match       https://gigazine.net/news/*
// @grant       none
// @version     1.0
// @author      akku
// @description 5/8/2024, 12:49:06 AM
// ==/UserScript==

document.querySelectorAll("img.lazyload").forEach((tag) =>
  tag.src = tag.getAttribute("data-src")
);
