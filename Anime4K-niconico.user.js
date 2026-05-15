// ==UserScript==
// @name        Anime4K niconico
// @namespace   Violentmonkey Scripts
// @match       https://www.nicovideo.jp/*
// @author      akku
// @grant       none
// @version     1.0
// @author      -
// @description 4/22/2026, 10:57:04 PM
// @top-level-await
// ==/UserScript==

const sleep = (s) => new Promise(resolve => setTimeout(resolve, 1000 * s));

/**
 * 次のURL遷移（navigateイベント）が発生するまで待機するPromise
 * @returns {Promise<NavigationNavigateEvent>} 遷移イベントオブジェクトを返す
 */
function waitForNavigation() {
  return new Promise((resolve) => {
    navigation.addEventListener('navigate', (event) => {
      resolve(event);
    }, { once: true }); // ここで自動解除を指定
  });
}

const main = async (url) => {
  await sleep(2);
  const upscale = url.startsWith('https://www.nicovideo.jp/watch/') && document.querySelector('meta[property="og:video:tag"][content="アニメ"]');
  const upscaler = new Anime4KJS.VideoUpscaler(30 /* TARGET FPS */, Anime4KJS.ANIME4KJS_SIMPLE_UL_2X /* PROFILE */);
  if(upscale) {
    const videoElement = document.getElementsByTagName("video")[0];

    const canvasElement = document.createElement("canvas");
    canvasElement.width=1920;
    canvasElement.height=1080;
    canvasElement.style = `
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    height: inherit;
    width: inherit;
    `;

    videoElement.parentElement.appendChild(canvasElement);
    videoElement.style.visibility = "hidden";
    upscaler.attachVideo(videoElement, canvasElement);
    upscaler.start();

    console.log("開始");
  } else console.log("アップスケール対象外のページ");
  const e = await waitForNavigation();
  if(upscale) {
    upscaler.stop();
    console.log("停止");
  }
  return e.destination.url;
}

const Anime4KJS = await import("https://cdn.jsdelivr.net/gh/akku1139/Anime4K.js@0ceeac916765ec089bfd6e716932d8cba66d2732/anime4k.js");

let next = location.href;
while(true) {
  next = await main(next);
  console.log("next url:", next);
}
