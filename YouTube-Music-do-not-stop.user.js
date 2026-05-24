// ==UserScript==
// @name        No stop YouTube Music
// @namespace   Violentmonkey Scripts
// @match       https://music.youtube.com/*
// @grant       none
// @author      akku
// @description 11/22/2024, 7:29:38 PM
// @description YouTube music has been modified to detect tab transitions and stop the music.
// @run-at      document-start
// @license     Unlicense
// ==/UserScript==

// https://gist.github.com/akku1139/29133fcecf9bbb981908fed7ab4bad5f
// https://zenn.dev/raihara3/articles/20220214_background_tab
// https://gist.github.com/lchanouha/06b51423bc60693af216ebdce37d86a8
// Sourced from: https://stackoverflow.com/questions/47660653/chrome-extension-how-to-disable-page-visibility-api

window.addEventListener("visibilitychange", (e) => {
  e.stopImmediatePropagation()
}, true)
