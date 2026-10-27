(() => {
  "use strict";

  const doc = document;
  const q = (selector, root = doc) => root.querySelector(selector);
  const qa = (selector, root = doc) => Array.from(root.querySelectorAll(selector));
  const connection = navigator.connection;
  const constrained = Boolean(
    connection &&
      (connection.saveData || /(^|-)2g$|^3g$/.test(connection.effectiveType || "")),
  );

  const header = q("[data-navbar]");
  const menuPanel = q("[data-menu-panel]");
  const menuBackdrop = q("[data-menu-backdrop]");
  const menuLinks = menuPanel ? qa("[data-menu-link]", menuPanel) : [];

  const setMenu = (open) => {
    if (!menuPanel || !menuBackdrop) return;
    menuPanel.classList.toggle("translate-x-full", !open);
    menuPanel.classList.toggle("translate-x-0", open);
    menuPanel.toggleAttribute("inert", !open);
    menuPanel.setAttribute("aria-hidden", String(!open));
    menuBackdrop.classList.toggle("opacity-0", !open);
    menuBackdrop.classList.toggle("opacity-100", open);
    menuBackdrop.classList.toggle("pointer-events-none", !open);
    menuBackdrop.setAttribute("aria-hidden", String(!open));
    menuLinks.forEach((link, index) => {
      link.classList.toggle("translate-x-6", !open);
      link.classList.toggle("opacity-0", !open);
      link.classList.toggle("translate-x-0", open);
      link.classList.toggle("opacity-100", open);
      link.style.transitionDelay = open ? `${0.05 + index * 0.06}s` : "0s";
    });
  };

  qa("[data-menu-open]").forEach((button) =>
    button.addEventListener("click", () => setMenu(true)),
  );
  qa("[data-menu-close]").forEach((button) =>
    button.addEventListener("click", () => setMenu(false)),
  );
  if (menuBackdrop) menuBackdrop.addEventListener("click", () => setMenu(false));
  if (menuPanel) {
    menuPanel.addEventListener("click", (event) => {
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (link) setMenu(false);
    });
  }
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });

  if (header) {
    const onScroll = () => {
      const scrolled = window.scrollY > 24;
      header.classList.toggle("glass", scrolled);
      header.classList.toggle("bg-transparent", !scrolled);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  const workflow = q("[data-workflow]");
  if (workflow) {
    const tabs = qa("[data-workflow-step]", workflow);
    const bodies = qa("[data-workflow-body]", workflow);
    const panels = qa("[data-workflow-panel]", workflow);
    const activate = (index) => {
      tabs.forEach((tab, tabIndex) => {
        const open = tabIndex === index;
        tab.setAttribute("aria-expanded", String(open));
        tab.classList.toggle("-translate-x-1", open);
        tab.classList.toggle("opacity-60", !open);
        tab.classList.toggle("hover:opacity-90", !open);
        const color = tab.getAttribute("data-workflow-color");
        tab.style.borderColor = open && color ? `${color}66` : "";
        tab.style.boxShadow = open && color ? `6px 6px 0 ${color}55` : "";
      });
      bodies.forEach((body, bodyIndex) => {
        const open = bodyIndex === index;
        body.classList.toggle("grid-rows-[1fr]", open);
        body.classList.toggle("grid-rows-[0fr]", !open);
        body.classList.toggle("opacity-100", open);
        body.classList.toggle("opacity-0", !open);
      });
      panels.forEach((panel, panelIndex) => {
        const open = panelIndex === index;
        panel.classList.toggle("hidden", !open);
        if (open) {
          panel.classList.remove("panel-in");
          void panel.offsetWidth;
          panel.classList.add("panel-in");
        }
      });
    };
    tabs.forEach((tab, index) =>
      tab.addEventListener("click", () => activate(index)),
    );
  }

  const preview = q("[data-app-preview]");
  if (preview) {
    let modes = {};
    try {
      modes = JSON.parse(preview.getAttribute("data-modes") || "{}");
    } catch {
      modes = {};
    }
    const tabs = qa("[data-preview-mode]", preview);
    const lists = new Map(
      qa("[data-preview-steps]", preview).map((list) => [
        list.getAttribute("data-preview-steps"),
        list,
      ]),
    );
    const title = q("[data-preview-title]", preview);
    const clip = q("[data-preview-clip]", preview);
    const cursor = q("[data-preview-cursor]", preview);
    const status = q("[data-preview-status]", preview);
    const runButton = q("[data-preview-run]", preview);
    const startLabel = q("[data-preview-start]", preview);
    const stopLabel = q("[data-preview-stop]", preview);
    let mode = "aio";
    let step = -1;
    let running = false;
    let timer = 0;

    const stepsOf = () => (modes[mode] && modes[mode].steps) || [];
    const setTabs = () => {
      tabs.forEach((tab) => {
        const active = tab.getAttribute("data-preview-mode") === mode;
        tab.setAttribute("aria-selected", String(active));
        tab.classList.toggle("bg-crimson", active);
        tab.classList.toggle("font-bold", active);
        tab.classList.toggle("text-ink", active);
        tab.classList.toggle("border", !active);
        tab.classList.toggle("border-paper/15", !active);
        tab.classList.toggle("text-paper/50", !active);
        tab.classList.toggle("hover:border-paper/40", !active);
        tab.classList.toggle("hover:text-paper", !active);
      });
      lists.forEach((list, key) => list.classList.toggle("hidden", key !== mode));
    };

    const paint = () => {
      const steps = stepsOf();
      const total = Math.max(steps.length, 1);
      const progress = running || step >= 0 ? ((step + 1) / total) * 100 : 0;
      if (clip) clip.style.clipPath = `inset(0 ${100 - progress}% 0 0)`;
      if (cursor) {
        const show = running && progress > 0 && progress < 100;
        cursor.classList.toggle("hidden", !show);
        if (show) cursor.style.left = `${progress}%`;
      }
      const list = lists.get(mode);
      if (list) {
        const items = Array.from(list.querySelectorAll("li"));
        items.forEach((item, index) => {
          const done = index <= step;
          const current = running && index === step;
          const marker = item.querySelector("[data-preview-marker]");
          const label = item.querySelector("[data-preview-label]");
          const itemCursor = item.querySelector("[data-preview-cursor]");
          if (marker) {
            marker.style.borderColor = done ? "#ff2e63" : "";
            marker.style.background = done ? "#ff2e63" : "";
            marker.style.color = done ? "#07070c" : "";
            marker.textContent = done ? "✓" : String(index + 1);
          }
          if (label) label.style.color = done ? "#f2ede3" : "";
          if (itemCursor) itemCursor.classList.toggle("hidden", !current);
        });
      }
      if (status) {
        status.textContent = running
          ? `${steps[Math.max(step, 0)] || "Running"}…`
          : progress >= 100
            ? "✓ Release ready"
            : "Idle — raw loaded";
      }
      if (startLabel) {
        startLabel.classList.toggle("hidden", running);
        startLabel.classList.toggle("inline-flex", !running);
      }
      if (stopLabel) {
        stopLabel.classList.toggle("hidden", !running);
        stopLabel.classList.toggle("inline-flex", running);
      }
    };

    const stop = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = 0;
      }
      running = false;
      paint();
    };

    const start = () => {
      stop();
      step = -1;
      running = true;
      paint();
      timer = window.setInterval(() => {
        if (!running) return;
        const total = stepsOf().length;
        if (step + 1 >= total) {
          step = total - 1;
          stop();
          return;
        }
        step += 1;
        paint();
      }, 850);
    };

    const switchMode = (next) => {
      stop();
      mode = next;
      step = -1;
      setTabs();
      if (title && modes[mode]) {
        title.textContent = `koma://project/oneshot-ch-01 — ${modes[mode].label}`;
      }
      paint();
    };

    tabs.forEach((tab) =>
      tab.addEventListener("click", () => {
        const next = tab.getAttribute("data-preview-mode");
        if (next) switchMode(next);
      }),
    );
    if (runButton) {
      runButton.addEventListener("click", () => {
        if (running) stop();
        else start();
      });
    }
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reducedMotion) {
    // Every .koma-reveal lives below the hero, so no viewport measurement is
    // needed. Reading rects in this loop would force one full layout per
    // element and delay the first paint on slow devices.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "true");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "-80px" },
    );
    qa(".koma-reveal").forEach((element) => {
      element.setAttribute("data-revealed", "false");
      observer.observe(element);
    });
  }

  qa("[data-copy-command]").forEach((button) => {
    button.addEventListener("click", () => {
      const command = button.getAttribute("data-copy-command") || "";
      const label = button.querySelector("[data-copy-label]");
      const original = label ? label.textContent : "";
      const markCopied = () => {
        if (!label) return;
        label.textContent = "Copied";
        window.setTimeout(() => {
          label.textContent = original;
        }, 2000);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(command).then(markCopied).catch(() => {});
        return;
      }
      const textArea = doc.createElement("textarea");
      textArea.value = command;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      doc.body.appendChild(textArea);
      textArea.select();
      try {
        doc.execCommand("copy");
        markCopied();
      } catch {
        /* Clipboard unavailable. */
      }
      doc.body.removeChild(textArea);
    });
  });

  const loadSocialProof = () => {
    if (constrained) return;
    const starSlots = qa("[data-github-stars]");
    if (starSlots.length > 0) {
      fetch("https://api.github.com/repos/klaus-2/koma-studio")
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          const count = payload && typeof payload.stargazers_count === "number" ? payload.stargazers_count : null;
          if (count === null) return;
          const formatted = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
          starSlots.forEach((slot) => {
            slot.textContent = slot.getAttribute("data-stars-format") === "full" ? `★ ${formatted}` : formatted;
            slot.hidden = false;
          });
        })
        .catch(() => {});
    }
    const download = q("[data-latest-download]");
    const meta = q("[data-latest-meta]");
    if (download) {
      fetch("https://api.github.com/repos/klaus-2/koma-studio/releases/latest")
        .then((response) => (response.ok ? response.json() : null))
        .then((release) => {
          if (!release || typeof release.tag_name !== "string" || !Array.isArray(release.assets)) return;
          const prefix = "https://github.com/klaus-2/koma-studio/releases/download/";
          const asset = release.assets.find(
            (entry) =>
              entry &&
              typeof entry.name === "string" &&
              (entry.name.endsWith("_x64-setup.exe") || entry.name.endsWith("-setup-tauri.exe")) &&
              typeof entry.browser_download_url === "string" &&
              entry.browser_download_url.startsWith(prefix) &&
              typeof entry.size === "number",
          );
          if (!asset) return;
          download.setAttribute("href", asset.browser_download_url);
          if (meta) {
            meta.textContent = `Tauri · ${release.tag_name} · ${(asset.size / (1024 * 1024)).toFixed(1)} MB`;
            meta.hidden = false;
          }
        })
        .catch(() => {});
    }
  };

  if (document.readyState === "complete") {
    window.setTimeout(loadSocialProof, 1200);
  } else {
    window.addEventListener("load", () => window.setTimeout(loadSocialProof, 1200), { once: true });
  }

  if (navigator.modelContext && typeof navigator.modelContext.provideContext === "function") {
    navigator.modelContext.provideContext({
      tools: [
        {
          name: "download_koma_studio_windows",
          description: "Returns the stable Windows download URL for KOMA Studio.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          execute: async () => ({
            content: [{ type: "text", text: "Download KOMA Studio for Windows: https://koma-studio.site/download/windows" }],
            structuredContent: { url: "https://koma-studio.site/download/windows", platform: "windows", channel: "stable" },
          }),
        },
        {
          name: "open_koma_community",
          description: "Returns the primary KOMA Studio community and support links.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          execute: async () => ({
            content: [{ type: "text", text: "Community: https://discord.gg/tzaV2efD4e\nChat: https://chat.koma-studio.site" }],
            structuredContent: { discord: "https://discord.gg/tzaV2efD4e", chat: "https://chat.koma-studio.site" },
          }),
        },
        {
          name: "list_koma_agent_resources",
          description: "Returns the main machine-readable discovery URLs for KOMA Studio.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          execute: async () => ({
            content: [{ type: "text", text: "https://koma-studio.site/llms.txt" }],
            structuredContent: {
              llms: "https://koma-studio.site/llms.txt",
              apiCatalog: "https://koma-studio.site/.well-known/api-catalog",
              agentSkills: "https://koma-studio.site/.well-known/agent-skills/index.json",
              mcpCard: "https://koma-studio.site/.well-known/mcp/server-card.json",
            },
          }),
        },
      ],
    });
  }
})();
