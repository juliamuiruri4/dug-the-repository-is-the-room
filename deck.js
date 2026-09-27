export function boundedSlide(number, total) {
  return Math.max(1, Math.min(total, number));
}

export function parseSlideHash(hash, total) {
  const match = /^#slide-([1-9]\d*)$/.exec(hash);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) && number <= total ? number : null;
}

export function slideForKey(key, current, total) {
  switch (key) {
    case "ArrowRight":
    case "PageDown":
    case " ":
      return boundedSlide(current + 1, total);
    case "ArrowLeft":
    case "PageUp":
      return boundedSlide(current - 1, total);
    case "Home":
      return 1;
    case "End":
      return total;
    default:
      return null;
  }
}

export const openingSteps = 4;

export function nextPosition(slide, step, direction, total) {
  if (slide === 1 && direction > 0 && step < openingSteps) return { slide, step: step + 1 };
  if (slide === 1 && direction < 0 && step > 0) return { slide, step: step - 1 };
  return { slide: boundedSlide(slide + direction, total), step: 0 };
}

function initDeck() {
  const deck = document.querySelector("#deck");
  const slides = [...deck.querySelectorAll("[data-slide]")];
  const opening = slides[0];
  const phrases = [...opening.querySelectorAll("[data-opening-step]")];
  const focalPoints = [...opening.querySelectorAll("[data-opening-focus]")];
  if (phrases.length !== openingSteps || focalPoints.length !== openingSteps) {
    throw new Error("Slide 1 needs four phrases and four diagram focal points");
  }
  const previous = document.querySelector("#previous");
  const next = document.querySelector("#next");
  const counter = document.querySelector("#slide-counter");
  const progress = document.querySelector("#progress-track");
  const fill = document.querySelector("#progress-fill");
  const announcement = document.querySelector("#slide-announcement");
  const help = document.querySelector("#help-dialog");
  let current = 0;
  let openingStep = 0;
  let touchStart = null;
  let suppressClickUntil = 0;

  function setOpeningStep(step, announce = true) {
    if (step === openingStep) return;
    openingStep = step;
    opening.dataset.openingStep = String(step);
    phrases.forEach((phrase, index) => {
      phrase.classList.toggle("is-revealed", index < step);
      phrase.classList.toggle("is-current", index === step - 1);
    });
    focalPoints.forEach((point, index) => point.classList.toggle("is-current", index === step - 1));
    previous.disabled = current === 1 && step === 0;
    if (announce && current === 1) {
      announcement.textContent = step === 0
        ? "Slide 1: Highlights reset."
        : `Slide 1, highlight ${step} of ${openingSteps}: ${phrases[step - 1].textContent.trim()}.`;
    }
  }

  function showSlide(number, updateHistory = true) {
    const target = boundedSlide(number, slides.length);
    if (target === current) return;

    if (current) {
      const departing = slides[current - 1];
      departing.querySelector("video")?.pause();
      departing.hidden = true;
      if (current === 1) setOpeningStep(0, false);
    }
    slides[target - 1].hidden = false;
    slides[target - 1].scrollTop = 0;
    current = target;
    if (current === 1) setOpeningStep(0, false);

    counter.textContent = `${String(current).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
    progress.setAttribute("aria-valuenow", String(current));
    fill.style.transform = `scaleX(${current / slides.length})`;
    previous.disabled = current === 1;
    next.disabled = current === slides.length;
    announcement.textContent = slides[current - 1].getAttribute("aria-label");

    if (updateHistory) {
      history.pushState(null, "", `#slide-${current}`);
    }
  }

  function move(direction) {
    const target = nextPosition(current, openingStep, direction, slides.length);
    if (target.slide === current) {
      if (current === 1) setOpeningStep(target.step);
    } else {
      showSlide(target.slide);
    }
  }

  const initial = parseSlideHash(location.hash, slides.length) ?? 1;
  slides.forEach((slide) => { slide.hidden = true; });
  showSlide(initial, false);
  if (parseSlideHash(location.hash, slides.length) === null) {
    history.replaceState(null, "", `#slide-${initial}`);
  }

  previous.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));

  document.addEventListener("keydown", (event) => {
    if (help.open || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof Element && event.target.closest("video, [data-deck-scroll], input, textarea, select, [contenteditable]")) return;

    const target = slideForKey(event.key, current, slides.length);
    if (target === null) return;
    if (event.key === " " && event.target instanceof Element && event.target.closest("button, a")) return;
    event.preventDefault();
    if (event.key === "Home" && current === 1) setOpeningStep(0);
    else if (event.key === "Home" || event.key === "End") showSlide(target);
    else move(["ArrowRight", "PageDown", " "].includes(event.key) ? 1 : -1);
  });

  deck.addEventListener("click", (event) => {
    if (Date.now() < suppressClickUntil || window.getSelection()?.toString()) return;
    if (event.target instanceof Element && event.target.closest("a, button, video, [data-deck-scroll]")) return;
    const middle = deck.getBoundingClientRect().left + deck.getBoundingClientRect().width / 2;
    move(event.clientX < middle ? -1 : 1);
  });

  deck.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch" && !(event.target instanceof Element && event.target.closest("a, button, video, [data-deck-scroll]"))) {
      touchStart = { x: event.clientX, y: event.clientY };
    }
  });
  deck.addEventListener("pointerup", (event) => {
    if (!touchStart || event.pointerType !== "touch") return;
    if (event.target instanceof Element && event.target.closest("a, button, video, [data-deck-scroll]")) {
      touchStart = null;
      return;
    }
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    suppressClickUntil = Date.now() + 400;
    move(dx < 0 ? 1 : -1);
  });
  deck.addEventListener("pointercancel", () => { touchStart = null; });

  const followHash = () => {
    const target = parseSlideHash(location.hash, slides.length);
    showSlide(target ?? 1, false);
    if (target === null) history.replaceState(null, "", "#slide-1");
  };
  window.addEventListener("popstate", followHash);
  window.addEventListener("hashchange", followHash);

  document.querySelector("#help-button").addEventListener("click", () => help.showModal());
  document.querySelector("#close-help").addEventListener("click", () => help.close());
}

if (typeof document !== "undefined") {
  initDeck();
}
