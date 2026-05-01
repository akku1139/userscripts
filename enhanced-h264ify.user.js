// ==UserScript==
// @name         enhanced-h264ify
// @namespace    Violentmonkey Scripts
// @version      0.1
// @description  enhanced-h264ify for user script.
// @author       akku
// @match        *://*.youtube.com/*
// @match        *://*.youtube-nocookie.com/*
// @match        *://*.youtu.be/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2024 akku
 * Copyright (c) 2019 alextrv
 * Copyright (c) 2015 erkserkserks
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const config = {
  'block_60fps': true,
  'block_h264':  false,
  'block_vp8':   true,
  'block_vp9':   true,
  'block_av1':   true,
  'disable_LN':  true,
};

function inject () {

  override();

  function override() {
    // Override video element canPlayType() function
    var videoElem = document.createElement('video');
    var origCanPlayType = videoElem.canPlayType.bind(videoElem);
    videoElem.__proto__.canPlayType = makeModifiedTypeChecker(origCanPlayType);

    // Override media source extension isTypeSupported() function
    var mse = window.MediaSource;
    // Check for MSE support before use
    if (mse === undefined) return;
    var origIsTypeSupported = mse.isTypeSupported.bind(mse);
    mse.isTypeSupported = makeModifiedTypeChecker(origIsTypeSupported);
  }

  // return a custom MIME type checker that can defer to the original function
  function makeModifiedTypeChecker(origChecker) {
    // Check if a video type is allowed
    return function (type) {
      if (type === undefined) return '';
      var disallowed_types = [];
      if (config['block_h264']) {
        disallowed_types.push('avc');
      }
      if (config['block_vp8']) {
        disallowed_types.push('vp8');
      }
      if (config['block_vp9']) {
        disallowed_types.push('vp9', 'vp09');
      }
      if (config['block_av1']) {
        disallowed_types.push('av01');
      }

      // If video type is in disallowed_types, say we don't support them
      for (var i = 0; i < disallowed_types.length; i++) {
        if (type.indexOf(disallowed_types[i]) !== -1) return '';
      }

      if (config['block_60fps']) {
        var match = /framerate=(\d+)/.exec(type);
        if (match && match[1] > 30) return '';
      }

      // Otherwise, ask the browser
      return origChecker(type);
    };
  }
}

function useActualVolumeLevel() {

  if (!config['disable_LN']) {
    return;
  }

  var video = document.querySelector('video');
  var observerConfig = {attributes: true};

  var onVolumeChange = function(mutationList) {
    var attr = 'aria-valuenow';
    for (var mutation of mutationList) {
      if (mutation.attributeName == attr) {
        // Get current volume level from player's attribute
        // and set the actual volume
        video.volume = mutation.target.attributes[attr].value / 100;
      }
    }
  }

  var volumePanel = document.querySelector('.ytp-volume-panel');
  if (volumePanel) {
    var observer = new MutationObserver(onVolumeChange);
    observer.observe(volumePanel, observerConfig);
  }
}

inject();
document.onreadystatechange = useActualVolumeLevel;
