const FALLBACK_RINGTONE = "/sounds/notification.mp3";

let ringtone = null;
let currentSrc = "";
let unlocked = false;

function resolveSrc(src) {
  const next = String(src || "").trim();
  return next || FALLBACK_RINGTONE;
}

function getRingtone(src) {
  if (typeof window === "undefined") return null;
  const nextSrc = resolveSrc(src);
  if (!ringtone || currentSrc !== nextSrc) {
    ringtone = new Audio(nextSrc);
    ringtone.preload = "auto";
    ringtone.volume = 0.9;
    currentSrc = nextSrc;
    unlocked = false;
  }
  return ringtone;
}

/** Unlock audio after first user gesture (browsers block autoplay otherwise) */
export function unlockNotificationAudio(src) {
  try {
    const audio = getRingtone(src);
    if (!audio || unlocked) return;
    const prev = audio.volume;
    audio.volume = 0.01;
    const play = audio.play();
    if (play && typeof play.then === "function") {
      play
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = prev;
          unlocked = true;
        })
        .catch(() => {
          audio.volume = prev;
        });
    } else {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = prev;
      unlocked = true;
    }
  } catch {
    // ignore
  }
}

/** Play notification ringtone (uploaded mp3/wav URL or fallback) */
export function playNotificationChime(src) {
  try {
    const audio = getRingtone(src);
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0.9;
    const play = audio.play();
    if (play && typeof play.catch === "function") {
      play.catch(() => {
        unlocked = false;
      });
    }
  } catch {
    // ignore
  }
}

export { FALLBACK_RINGTONE };
