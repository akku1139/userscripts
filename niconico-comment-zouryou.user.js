// ==UserScript==
// @name         ニコニコ コメント増量インジェクター
// @namespace    https://nicovideo.jp/
// @version      1.0.0
// @description  /v1/threads のレスポンスに過去コメントを全件追加して増量する
// @author       akku
// @match        https://www.nicovideo.jp/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

// ============================================================
// 設定
// ============================================================

// 1スレッドあたりの遡り取得回数（1回=最大1000件）
const COMMENT_LIMIT = 5;

// easyスレッドをスキップするか
const SKIP_EASY = true;

// レート制限回避の待機しきい値（COMMENT_LIMIT がこの値を超えたら1秒待機）
const WAIT_THRESHOLD = 20;

// ============================================================
// 内部状態
// ============================================================

let collectedComments = [];
let collectionReady   = false;
let collectionPromise = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dedupeByNo = (arr) => {
  const seen = new Set();
  const result = [];

  for (const c of arr) {
    if (seen.has(c.no)) continue;
    seen.add(c.no);
    result.push(c);
  }

  return result;
};

// ============================================================
// fetch フック（document-start で最初に設置）
// ============================================================

const TARGET_URL    = "https://public.nvcomment.nicovideo.jp/v1/threads";
const _originalFetch = window.fetch;

window.fetch = async function (...args) {
  const [input] = args;

  let url = "";
  if (typeof input === "string")        url = input;
  else if (input instanceof URL)        url = input.href;
  else if (input instanceof Request)    url = input.url;

  // ターゲット以外はそのまま通す
  if (!url.startsWith(TARGET_URL)) {
    return _originalFetch.apply(this, args);
  }

  console.log("[CommentInject] /v1/threads フック:", url);

  const response = await _originalFetch.apply(this, args);

  // 収集が完了していなければ待機
  if (!collectionReady && collectionPromise) {
    console.log("[CommentInject] コメント収集完了を待機中...");
    await collectionPromise;
  }

  if (collectedComments.length === 0) {
    console.log("[CommentInject] 追加コメントなし。元のレスポンスをそのまま返します。");
    return response;
  }

  const cloned = response.clone();
  let json;
  try {
    json = await cloned.json();
  } catch (e) {
    console.warn("[CommentInject] JSONパース失敗:", e);
    return response;
  }

  try {
    json = injectComments(json, collectedComments);
    console.log(`[CommentInject] ${collectedComments.length}件のコメントを注入しました`);
  } catch (e) {
    console.warn("[CommentInject] 注入処理エラー:", e);
    return response;
  }

  return new Response(JSON.stringify(json), {
    status:     response.status,
    statusText: response.statusText,
    headers:    response.headers,
  });
};

// ============================================================
// コメント注入処理
// ============================================================

function injectComments(json, comments) {
  if (!json?.data?.threads || !Array.isArray(json.data.threads)) {
    console.warn("[CommentInject] data.threads が見つかりません");
    return json;
  }

  // fork === "main" を優先、なければ最初のスレッドに注入
  let targetThread = json.data.threads.find((t) => t.fork === "main");
  if (!targetThread) targetThread = json.data.threads[0];
  if (!targetThread) return json;

  if (!Array.isArray(targetThread.comments)) targetThread.comments = [];

  // 既存コメントのnoセットで重複を除外
  const existingNos = new Set(targetThread.comments.map((c) => c.no));
  const toInject    = comments.filter((c) => !existingNos.has(c.no));

  targetThread.comments.push(...toInject);

  if (typeof targetThread.commentCount === "number") {
    targetThread.commentCount += toInject.length;
  }

  return json;
}

// ============================================================
// コメント収集（LOADCOMMENT の移植）
// ============================================================

async function loadAllComments() {
  const match =
    location.href.match(/\/watch\/(sm\d+)/) ||
    location.href.match(/\/watch\/(so\d+)/);
  if (!match) {
    console.warn("[CommentInject] 動画IDが取得できませんでした");
    return;
  }

  console.log("[CommentInject] apiData を取得中...");
  let apiData;
  try {
    const req = await _originalFetch(
      "https://www.nicovideo.jp/watch/" + match[1] + "?responseType=json"
    );
    apiData = (await req.json()).data.response;
  } catch (e) {
    console.warn("[CommentInject] apiData の取得に失敗しました:", e);
    return;
  }

  const nvComment = apiData.comment.nvComment;
  const threads   = apiData.comment.threads;

  let threadKey          = nvComment.threadKey;
  let fetchedThreadCount = 0;
  const totalThreadCount = nvComment.params.targets.length * COMMENT_LIMIT;

  const ownerComments = [];
  const comments      = [];

  const joinObj = (obj, fd = "", sd = "") =>
    Object.entries(obj).map(([k, v]) => k + fd + v).join(sd);

  let isLoggedIn    = true;
  const legacyParams = {
    version:  "20090904",
    scores:   "1",
    nicoru:   "3",
    fork:     0,
    language: "0",
    thread:   threads[2]?.id,
  };

  for (const i in nvComment.params.targets) {
    const thread = nvComment.params.targets[i];

    if (SKIP_EASY && thread.fork === "easy") continue;

    let baseData = {
      threadKey,
      params: {
        language: nvComment.params.language,
        targets:  [thread],
      },
    };

    let lastTime  = Math.floor(Date.now() / 1000);
    let FailCount = 0;

    for (let j = 0; j < COMMENT_LIMIT; j++) {
      if (isLoggedIn) {
        // ---- nvComment API（ログイン済み）----
        let res;
        try {
          const req = await _originalFetch(`${nvComment.server}/v1/threads`, {
            method:  "POST",
            headers: {
              "content-type":       "text/plain;charset=UTF-8",
              "x-client-os-type":   "others",
              "x-frontend-id":      "6",
              "x-frontend-version": "0",
            },
            body: JSON.stringify({
              ...baseData,
              additionals: { res_from: -1000, when: lastTime },
            }),
          });
          res = await req.json();
        } catch (e) {
          console.warn("[CommentInject] fetch エラー:", e);
          break;
        }

        // レート制限 → 60秒待機してリトライ
        if (res?.meta?.errorCode === "TOO_MANY_REQUESTS") {
          for (let w = 0; w < 60; w++) {
            console.log(`[CommentInject] レート制限。あと${60 - w}秒待機...`);
            await sleep(1000);
          }
          j--;
          continue;
        }

        // トークン期限切れ → threadKey を再取得してリトライ
        if (res?.meta?.errorCode === "EXPIRED_TOKEN") {
          console.log("[CommentInject] threadKey を再取得...");
          try {
            const r = await _originalFetch(
              "https://nvapi.nicovideo.jp/v1/comment/keys/thread?videoId=" + apiData.video.id,
              {
                headers: {
                  "X-Frontend-Id":      "6",
                  "X-Frontend-Version": "0",
                  "Content-Type":       "application/json",
                },
                credentials: "include",
              }
            );
            const keyData      = await r.json();
            threadKey          = keyData.data.threadKey;
            baseData.threadKey = keyData.data.threadKey;
          } catch (e) {
            console.warn("[CommentInject] threadKey 再取得失敗:", e);
          }
          j--;
          continue;
        }

        // 未ログイン → レガシーAPIへフォールバック
        if (res?.meta?.errorCode === "INVALID_TOKEN") {
          console.warn("[CommentInject] 未ログイン。レガシーAPIにフォールバックします。");
          isLoggedIn = false;
          j--;
          continue;
        }

        // コメントを蓄積
        const fetched = res?.data?.threads?.[0]?.comments ?? [];
        (thread.fork === "owner" ? ownerComments : comments).push(...fetched);

        if (fetched.length === 0 || fetched[0].no < 5) {
          console.log(`[CommentInject] [${fetchedThreadCount + j}/${totalThreadCount}] スレッド先頭まで到達`);
          break;
        }

        lastTime = Math.floor(new Date(fetched[0].postedAt).getTime() / 1000);
        console.log(`[CommentInject] [${fetchedThreadCount + j}/${totalThreadCount}] コメ番 ${fetched[0].no} まで取得`);

      } else {
        // ---- レガシーAPI（未ログイン）----
        const url =
          `${threads[1]?.server}/api.json/thread?` +
          joinObj({ ...legacyParams, when: lastTime, res_from: "-1000" }, "=", "&");

        console.log(`[CommentInject] レガシー: ${url}`);

        let comments_tmp;
        try {
          const req    = await _originalFetch(url);
          const text   = await req.text();
          comments_tmp = JSON.parse(text).slice(2);
          lastTime     = comments_tmp[0].chat.date;
        } catch (e) {
          lastTime -= 100;
          FailCount++;
          if (FailCount > 10) {
            console.warn("[CommentInject] レガシーAPI: 取得失敗が続いたので中断");
            break;
          }
          console.warn("[CommentInject] レガシーAPI: 取得失敗。リトライ...");
          j--;
          await sleep(1000);
          continue;
        }

        for (const comment of comments_tmp) {
          (comment.chat.user_id ? comments : ownerComments).push({
            body:        comment.chat.content,
            commands:    comment.chat.mail?.split(/\s+/g) ?? [],
            id:          0,
            isMyPost:    false,
            isPremium:   comment.chat.premium === 1,
            nicoruCount: 0,
            nicoruId:    null,
            no:          comment.chat.no,
            postedAt:    String(comment.chat.date),
            score:       0,
            source:      "",
            userId:      comment.chat.user_id,
            vposMs:      comment.chat.vpos * 10,
          });
        }

        if (comments_tmp.length === 0 || comments_tmp[0].chat.no < 5) {
          console.log(`[CommentInject] [${fetchedThreadCount + j}/${totalThreadCount}] スレッド先頭まで到達`);
          break;
        }

        lastTime = comments_tmp[0].chat.date;
        console.log(`[CommentInject] [${fetchedThreadCount + j}/${totalThreadCount}] コメ番 ${comments_tmp[0].chat.no} まで取得`);
      }

      // レート制限対策ウェイト
      if (COMMENT_LIMIT > WAIT_THRESHOLD) {
        await sleep(1000);
      }
    }

    if (!isLoggedIn) break;
    fetchedThreadCount += COMMENT_LIMIT;
  }

  // ニコニコ側のバグかも、もしかしたらdedupeByNoいらない
  collectedComments = dedupeByNo(comments);
  console.log(`[CommentInject] 収集完了: ${comments.length}件（投稿者コメント ${ownerComments.length}件は除外）`);
}

// ============================================================
// DOMContentLoaded でコメント収集を開始
// ============================================================

window.addEventListener("DOMContentLoaded", () => {
  collectionPromise = loadAllComments()
    .then(() => { collectionReady = true; })
    .catch((e) => {
      console.error("[CommentInject] コメント収集エラー:", e);
      collectionReady = true; // エラーでも待機解除
    });
});

console.log("[CommentInject] fetch フック設置完了。ターゲット:", TARGET_URL);
