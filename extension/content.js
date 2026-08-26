"use strict";

(() => {

  if (
    globalThis
      .__ZAKU_CHATDOCK_V05__
  )
    return;

  globalThis
    .__ZAKU_CHATDOCK_V05__ =
    true;


  const port =
    browser.runtime.connect({
      name: "chatdock-ui"
    });


  const STATE = {

    chatKey: null,
    convoId: null,
    title: "Chat",
    shortId: null,

    tabs: [],
    activeId: null,

    terminals:
      new Map(),

    runs:
      new Map(),

    bridge: false,

    width: 420,

    panelOpen: true,

    collapsed: false,

    autoSend: localStorage.getItem("zaku-chatdock:autoSend") !== "0",

    currentUrl:
      location.href,

    pickerSessions: []
  };


  const sleep =
    ms =>
      new Promise(
        r =>
          setTimeout(
            r,
            ms
          )
      );


  function sanitize(
    s,
    max = 28
  ) {

    const x =
      String(s || "")
        .replace(
          /\s+/g,
          " "
        )
        .replace(
          /[^\p{L}\p{N} _.-]/gu,
          ""
        )
        .trim();

    return (
      x ||
      "Chat"
    ).slice(
      0,
      max
    );
  }


  function slug(
    s,
    max = 24
  ) {

    return (
      sanitize(
        s,
        max
      )
        .normalize(
          "NFKD"
        )
        .replace(
          /[^\x00-\x7F]/g,
          ""
        )
        .replace(
          /[^A-Za-z0-9]+/g,
          "_"
        )
        .replace(
          /^_+|_+$/g,
          ""
        )
        .toLowerCase()
        .slice(
          0,
          max
        )
      ||
      "chat"
    );
  }


  function conversationInfo() {

    const m =
      location.pathname.match(
        /\/c\/([^/?#]+)/
      );

    const convoId =
      m
        ? m[1]
        : null;

    const shortId =
      convoId
        ? convoId
            .replace(
              /-/g,
              ""
            )
            .slice(
              0,
              8
            )
        : "new";

    let title = "";

    if (convoId) {

      const link =
        document.querySelector(
          `a[href="/c/${CSS.escape(convoId)}"]`
        );

      title =
        link
          ?.textContent
          ?.trim()
        ||
        "";
    }

    if (!title) {

      title =
        document.title
          .replace(
            /\s*[-–|]\s*ChatGPT.*$/i,
            ""
          )
          .replace(
            /^ChatGPT\s*[-–|]\s*/i,
            ""
          )
          .trim();
    }

    if (
      !title ||
      /^ChatGPT$/i.test(
        title
      )
    ) {

      title =
        convoId
          ? `Chat ${shortId}`
          : "New chat";
    }

    return {

      convoId,

      shortId,

      title:
        sanitize(
          title,
          30
        ),

      chatKey:
        convoId
          ? `c_${convoId}`
          : "new_chat"
    };
  }


  function tmuxName(
    host,
    n
  ) {

    return (
      `cd_` +
      `${slug(STATE.title, 20)}_` +
      `${STATE.shortId}_` +
      `${
        host === "zaku"
          ? "z"
          : "c"
      }${n}`
    );
  }


  function tabLabel(
    host,
    n
  ) {

    return (
      `${sanitize(STATE.title, 20)}` +
      ` · ` +
      `${
        host === "zaku"
          ? "Z"
          : "C"
      }${n}`
    );
  }


  function storageKey() {

    return (
      `chatdock:v05:` +
      STATE.chatKey
    );
  }


  async function saveMeta() {

    const data = {

      title:
        STATE.title,

      width:
        STATE.width,

      collapsed:
        STATE.collapsed,

      activeId:
        STATE.activeId,

      tabs:
        STATE.tabs.map(
          t => ({
            id: t.id,
            host: t.host,
            n: t.n,
            tmux: t.tmux,
            label: t.label,
            attached:
              !!t.attached
          })
        )
    };

    await browser
      .storage
      .local
      .set({
        [storageKey()]:
          data
      });
  }


  async function loadMeta() {

    const o =
      await browser
        .storage
        .local
        .get(
          storageKey()
        );

    return (
      o[storageKey()]
      ||
      null
    );
  }


  async function knownLabels() {

    const all =
      await browser
        .storage
        .local
        .get(null);

    const map =
      new Map();

    for (
      const [k, v]
      of Object.entries(all)
    ) {

      if (
        !k.startsWith(
          "chatdock:v05:"
        )
        ||
        !v?.tabs
      )
        continue;

      for (const t of v.tabs) {

        if (t.tmux) {

          map.set(
            `${t.host}:${t.tmux}`,
            t.label || t.tmux
          );
        }
      }
    }

    return map;
  }


  const root =
    document.createElement(
      "div"
    );

  root.id =
    "zaku-chatdock-root";

  document
    .documentElement
    .appendChild(root);


  const shadow =
    root.attachShadow({
      mode: "open"
    });


  const style =
    document.createElement(
      "style"
    );


  style.textContent = `
    :host{all:initial}

    *,*::before,*::after{
      box-sizing:border-box
    }

    #dock{
      position:fixed;
      top:0;
      right:0;
      width:520px;
      height:100vh;
      z-index:2147483646;
      background:#0b0b0b;
      color:#e8e8e8;
      border-left:1px solid #2d2d2d;
      display:flex;
      flex-direction:column;
      font-family:ui-sans-serif,system-ui,sans-serif;
      box-shadow:-12px 0 35px rgba(0,0,0,.25)
    }

    #dock.hidden{
      display:none
    }

    #grab{
      position:absolute;
      left:-5px;
      top:0;
      width:9px;
      height:100%;
      cursor:col-resize;
      z-index:20
    }

    #top{
      min-height:44px;
      display:flex;
      align-items:center;
      gap:6px;
      padding:6px 8px;
      border-bottom:1px solid #2a2a2a;
      background:#151515
    }

    #brand{
      font-weight:800;
      font-size:12px;
      white-space:nowrap
    }

    select,button{
      background:#222;
      color:#eee;
      border:1px solid #3a3a3a;
      border-radius:7px;
      padding:6px 8px;
      font:12px ui-sans-serif,system-ui,sans-serif
    }

    button{
      cursor:pointer
    }

    button:hover{
      background:#303030
    }

    #host{
      width:86px
    }

    #status{
      margin-left:auto;
      font-size:11px;
      color:#aaa;
      max-width:110px;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap
    }

    #tabs{
      display:flex;
      align-items:center;
      gap:5px;
      overflow-x:auto;
      padding:6px 7px;
      border-bottom:1px solid #222;
      background:#101010;
      min-height:40px
    }

    .tab{
      display:flex;
      align-items:center;
      gap:6px;
      padding:5px 8px;
      border-radius:7px;
      border:1px solid #2b2b2b;
      font-size:11px;
      cursor:pointer;
      white-space:nowrap;
      background:#181818
    }

    .tab.active{
      background:#2a2a2a;
      border-color:#565656
    }

    .tab .x{
      opacity:.55;
      font-weight:700
    }

    #termwrap{
      position:relative;
      flex:1;
      min-height:0;
      overflow:hidden
    }

    .terminal-slot{
      position:absolute;
      inset:0;
      padding:7px;
      display:none
    }

    .terminal-slot.active{
      display:block
    }

    #footer{
      min-height:36px;
      display:flex;
      gap:6px;
      align-items:center;
      padding:5px 7px;
      border-top:1px solid #242424;
      background:#121212;
      font-size:11px;
      color:#aaa
    }

    #footer button{
      padding:4px 7px;
      font-size:11px
    }

    #toast{
      position:absolute;
      right:10px;
      bottom:48px;
      z-index:60;
      background:#202020;
      border:1px solid #444;
      padding:8px 10px;
      border-radius:8px;
      font-size:11px;
      display:none;
      max-width:330px
    }

    #picker{
      position:absolute;
      top:46px;
      right:8px;
      width:360px;
      max-height:420px;
      overflow:auto;
      background:#151515;
      border:1px solid #444;
      border-radius:10px;
      padding:9px;
      z-index:70;
      display:none;
      box-shadow:0 12px 35px rgba(0,0,0,.45)
    }

    #picker.open{
      display:block
    }

    .pickrow{
      display:flex;
      gap:6px;
      align-items:center;
      margin-bottom:6px
    }

    .pickrow button{
      flex:1;
      text-align:left;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap
    }

    .chatdock-code-btn{
      position:absolute!important;
      right:8px!important;
      bottom:8px!important;
      z-index:15!important;
      background:#181818!important;
      color:#eee!important;
      border:1px solid #555!important;
      border-radius:7px!important;
      padding:5px 8px!important;
      font-size:11px!important;
      cursor:pointer!important;
      opacity:.94!important
    }

    .chatdock-code-btn:hover{
      opacity:1!important
    }

    #dock{
      transition:width .18s ease;
      overflow:hidden
    }

    #dock.collapsed{
      width:58px !important;
      min-width:58px !important
    }

    #dock.collapsed #grab{
      display:none !important
    }

    #dock.collapsed #brand,
    #dock.collapsed #host,
    #dock.collapsed #status,
    #dock.collapsed #tabs,
    #dock.collapsed #termwrap,
    #dock.collapsed #footer,
    #dock.collapsed #picker{
      display:none !important
    }

    #dock.collapsed #top{
      display:flex;
      flex-direction:column;
      align-items:stretch;
      justify-content:flex-start;
      gap:8px;
      padding:8px 6px;
      min-height:100vh
    }

    #dock.collapsed #top button{
      width:100%;
      min-height:42px;
      padding:8px 0;
      font-size:0;
      display:flex;
      align-items:center;
      justify-content:center
    }

    #dock.collapsed #newtab::before{
      content:"＋";
      font-size:20px
    }

    #dock.collapsed #sessions::before{
      content:"☰";
      font-size:18px
    }

    #dock.collapsed #autosend::before{
      content:"A";
      font-size:15px;
      font-weight:700
    }

    #dock.collapsed #hide::before{
      content:"❮";
      font-size:16px
    }

    #dock:not(.collapsed) #hide{
      min-width:36px;
      padding-left:0;
      padding-right:0
    }

    #dock:not(.collapsed) #hide::before{
      content:"❯";
      font-size:14px
    }
  `;

  shadow.appendChild(
    style
  );



  /*
   * CHATDOCK_V0125_INLINE_XTERM_CORE
   *
   * xterm.css is renderer infrastructure, not optional decoration.
   * Load it synchronously into this ShadowRoot before any Terminal
   * instance is created. This removes async races and silent fetch
   * failures around helper/accessibility/canvas positioning.
   */
  const xtermCoreStyle =
    document.createElement("style");

  xtermCoreStyle.dataset.chatdockXtermCore =
    "0.12.5";

  xtermCoreStyle.textContent =
    "/**\n * Copyright (c) 2014 The xterm.js authors. All rights reserved.\n * Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)\n * https://github.com/chjj/term.js\n * @license MIT\n *\n * Permission is hereby granted, free of charge, to any person obtaining a copy\n * of this software and associated documentation files (the \"Software\"), to deal\n * in the Software without restriction, including without limitation the rights\n * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n * copies of the Software, and to permit persons to whom the Software is\n * furnished to do so, subject to the following conditions:\n *\n * The above copyright notice and this permission notice shall be included in\n * all copies or substantial portions of the Software.\n *\n * THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\n * THE SOFTWARE.\n *\n * Originally forked from (with the author's permission):\n *   Fabrice Bellard's javascript vt100 for jslinux:\n *   http://bellard.org/jslinux/\n *   Copyright (c) 2011 Fabrice Bellard\n *   The original design remains. The terminal itself\n *   has been extended to include xterm CSI codes, among\n *   other features.\n */\n\n/**\n *  Default styles for xterm.js\n */\n\n.xterm {\n    cursor: text;\n    position: relative;\n    user-select: none;\n    -ms-user-select: none;\n    -webkit-user-select: none;\n}\n\n.xterm.focus,\n.xterm:focus {\n    outline: none;\n}\n\n.xterm .xterm-helpers {\n    position: absolute;\n    top: 0;\n    /**\n     * The z-index of the helpers must be higher than the canvases in order for\n     * IMEs to appear on top.\n     */\n    z-index: 5;\n}\n\n.xterm .xterm-helper-textarea {\n    padding: 0;\n    border: 0;\n    margin: 0;\n    /* Move textarea out of the screen to the far left, so that the cursor is not visible */\n    position: absolute;\n    opacity: 0;\n    left: -9999em;\n    top: 0;\n    width: 0;\n    height: 0;\n    z-index: -5;\n    /** Prevent wrapping so the IME appears against the textarea at the correct position */\n    white-space: nowrap;\n    overflow: hidden;\n    resize: none;\n}\n\n.xterm .composition-view {\n    /* TODO: Composition position got messed up somewhere */\n    background: #000;\n    color: #FFF;\n    display: none;\n    position: absolute;\n    white-space: nowrap;\n    z-index: 1;\n}\n\n.xterm .composition-view.active {\n    display: block;\n}\n\n.xterm .xterm-viewport {\n    /* On OS X this is required in order for the scroll bar to appear fully opaque */\n    background-color: #000;\n    overflow-y: scroll;\n    cursor: default;\n    position: absolute;\n    right: 0;\n    left: 0;\n    top: 0;\n    bottom: 0;\n}\n\n.xterm .xterm-screen {\n    position: relative;\n}\n\n.xterm .xterm-screen canvas {\n    position: absolute;\n    left: 0;\n    top: 0;\n}\n\n.xterm-char-measure-element {\n    display: inline-block;\n    visibility: hidden;\n    position: absolute;\n    top: 0;\n    left: -9999em;\n    line-height: normal;\n}\n\n.xterm.enable-mouse-events {\n    /* When mouse events are enabled (eg. tmux), revert to the standard pointer cursor */\n    cursor: default;\n}\n\n.xterm.xterm-cursor-pointer,\n.xterm .xterm-cursor-pointer {\n    cursor: pointer;\n}\n\n.xterm.column-select.focus {\n    /* Column selection mode */\n    cursor: crosshair;\n}\n\n.xterm .xterm-accessibility:not(.debug),\n.xterm .xterm-message {\n    position: absolute;\n    left: 0;\n    top: 0;\n    bottom: 0;\n    right: 0;\n    z-index: 10;\n    color: transparent;\n    pointer-events: none;\n}\n\n.xterm .xterm-accessibility-tree:not(.debug) *::selection {\n  color: transparent;\n}\n\n.xterm .xterm-accessibility-tree {\n  font-family: monospace;\n  user-select: text;\n  white-space: pre;\n}\n\n.xterm .xterm-accessibility-tree > div {\n  transform-origin: left;\n  width: fit-content;\n}\n\n.xterm .live-region {\n    position: absolute;\n    left: -9999px;\n    width: 1px;\n    height: 1px;\n    overflow: hidden;\n}\n\n.xterm-dim {\n    /* Dim should not apply to background, so the opacity of the foreground color is applied\n     * explicitly in the generated class and reset to 1 here */\n    opacity: 1 !important;\n}\n\n.xterm-underline-1 { text-decoration: underline; }\n.xterm-underline-2 { text-decoration: double underline; }\n.xterm-underline-3 { text-decoration: wavy underline; }\n.xterm-underline-4 { text-decoration: dotted underline; }\n.xterm-underline-5 { text-decoration: dashed underline; }\n\n.xterm-overline {\n    text-decoration: overline;\n}\n\n.xterm-overline.xterm-underline-1 { text-decoration: overline underline; }\n.xterm-overline.xterm-underline-2 { text-decoration: overline double underline; }\n.xterm-overline.xterm-underline-3 { text-decoration: overline wavy underline; }\n.xterm-overline.xterm-underline-4 { text-decoration: overline dotted underline; }\n.xterm-overline.xterm-underline-5 { text-decoration: overline dashed underline; }\n\n.xterm-strikethrough {\n    text-decoration: line-through;\n}\n\n.xterm-screen .xterm-decoration-container .xterm-decoration {\n\tz-index: 6;\n\tposition: absolute;\n}\n\n.xterm-screen .xterm-decoration-container .xterm-decoration.xterm-decoration-top-layer {\n\tz-index: 7;\n}\n\n.xterm-decoration-overview-ruler {\n    z-index: 8;\n    position: absolute;\n    top: 0;\n    right: 0;\n    pointer-events: none;\n}\n\n.xterm-decoration-top {\n    z-index: 2;\n    position: relative;\n}\n\n\n\n/* Derived from vs/base/browser/ui/scrollbar/media/scrollbar.css */\n\n/* xterm.js customization: Override xterm's cursor style */\n.xterm .xterm-scrollable-element > .scrollbar {\n    cursor: default;\n}\n\n/* Arrows */\n.xterm .xterm-scrollable-element > .scrollbar > .scra {\n\tcursor: pointer;\n\tfont-size: 11px !important;\n}\n\n.xterm .xterm-scrollable-element > .visible {\n\topacity: 1;\n\n\t/* Background rule added for IE9 - to allow clicks on dom node */\n\tbackground:rgba(0,0,0,0);\n\n\ttransition: opacity 100ms linear;\n\t/* In front of peek view */\n\tz-index: 11;\n}\n.xterm .xterm-scrollable-element > .invisible {\n\topacity: 0;\n\tpointer-events: none;\n}\n.xterm .xterm-scrollable-element > .invisible.fade {\n\ttransition: opacity 800ms linear;\n}\n\n/* Scrollable Content Inset Shadow */\n.xterm .xterm-scrollable-element > .shadow {\n\tposition: absolute;\n\tdisplay: none;\n}\n.xterm .xterm-scrollable-element > .shadow.top {\n\tdisplay: block;\n\ttop: 0;\n\tleft: 3px;\n\theight: 3px;\n\twidth: 100%;\n\tbox-shadow: var(--vscode-scrollbar-shadow, #000) 0 6px 6px -6px inset;\n}\n.xterm .xterm-scrollable-element > .shadow.left {\n\tdisplay: block;\n\ttop: 3px;\n\tleft: 0;\n\theight: 100%;\n\twidth: 3px;\n\tbox-shadow: var(--vscode-scrollbar-shadow, #000) 6px 0 6px -6px inset;\n}\n.xterm .xterm-scrollable-element > .shadow.top-left-corner {\n\tdisplay: block;\n\ttop: 0;\n\tleft: 0;\n\theight: 3px;\n\twidth: 3px;\n}\n.xterm .xterm-scrollable-element > .shadow.top.left {\n\tbox-shadow: var(--vscode-scrollbar-shadow, #000) 6px 0 6px -6px inset;\n}\n";

  shadow.appendChild(
    xtermCoreStyle
  );

  const dock =
    document.createElement(
      "div"
    );

  dock.id = "dock";

  dock.innerHTML = `
    <div id="grab"></div>

    <div id="top">

      <div id="brand">
        ZAKU CHATDOCK
      </div>

      <select id="host">
        <option value="zaku">
          Zaku
        </option>
        <option value="canavar">
          Canavar
        </option>
      </select>

      <button id="newtab">
        ＋ Terminal
      </button>

      <button id="sessions">
        ☰ Sessions
      </button>

      <button id="autosend">
        AUTO→CHAT ON
      </button>

      <button id="hide">
        ×
      </button>

      <div id="status">
        bağlanıyor
      </div>

      <div
        id="health"
        style="
          display:flex;
          align-items:center;
          gap:9px;
          min-height:18px;
          font-size:11px;
          font-weight:600;
          white-space:nowrap;
          user-select:none;
        "
      >
        <span id="health-native"
              style="color:#8b95a7"
              title="Native Messaging kontrol ediliyor">● Native</span>

        <span id="health-zaku"
              style="color:#8b95a7"
              title="Zaku kontrol ediliyor">● Zaku</span>

        <span id="health-canavar"
              style="color:#8b95a7"
              title="Canavar kontrol ediliyor">● Canavar</span>
      </div>

    </div>

    <div id="tabs"></div>

    <div id="termwrap"></div>

    <div id="footer">

      <button id="send50">
        Son 50 → Chat
      </button>

      <button id="send200">
        Son 200 → Chat
      </button>

      <span id="chatname"></span>

    </div>

    <div id="picker"></div>

    <div id="toast"></div>
  `;

  shadow.appendChild(
    dock
  );
  /* CHATDOCK_V0111_FINAL */
  (() => {
    const css=document.createElement("style");

    css.textContent=`
      #dock {
        box-sizing:border-box !important;
        overflow:visible !important;
      }

      /* Expanded header: controls wrap instead of disappearing */
      #top {
        display:grid !important;
        grid-template-columns:minmax(100px,1fr) auto auto;
        grid-template-areas:
          "brand host terminal"
          "sessions auto auto"
          "health health health"
          "status status status";
        gap:6px !important;
        align-items:center !important;
        padding:7px 9px !important;
        min-height:108px !important;
        overflow:visible !important;
        box-sizing:border-box !important;
      }

      #brand{grid-area:brand;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #host{grid-area:host}
      #newtab{grid-area:terminal}
      #sessions{grid-area:sessions}
      #autosend{grid-area:auto;justify-self:end}
      #status{grid-area:status;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

      /* Old × was the inaccessible control. */
      #hide{display:none !important}

      /* Real health LEDs */
      #health{
        grid-area:health;
        display:flex !important;
        flex-wrap:wrap !important;
        align-items:center !important;
        gap:6px !important;
        overflow:visible !important;
      }

      #health > span{
        display:inline-flex !important;
        align-items:center !important;
        gap:5px !important;
        padding:2px 7px !important;
        min-width:max-content;
        border:1px solid rgba(255,255,255,.10);
        border-radius:999px;
        background:rgba(255,255,255,.055);
        font-size:11px !important;
        line-height:17px;
      }

      #health > span::before{
        content:"";
        width:8px;
        height:8px;
        flex:0 0 8px;
        border-radius:50%;
        background:currentColor;
        box-shadow:0 0 6px currentColor;
      }

      /* Always-accessible handle outside the dock */
      #chatdock-collapse-handle{
        position:absolute !important;
        left:-28px !important;
        top:12px !important;
        z-index:2147483647 !important;
        display:flex !important;
        align-items:center !important;
        justify-content:center !important;
        width:28px !important;
        min-width:28px !important;
        height:42px !important;
        padding:0 !important;
        border:1px solid rgba(255,255,255,.18) !important;
        border-right:0 !important;
        border-radius:9px 0 0 9px !important;
        background:#181818 !important;
        color:white !important;
        font:700 22px/1 sans-serif !important;
        cursor:pointer !important;
      }

      #chatdock-collapse-handle:hover{
        background:#292929 !important;
      }

      /* TRUE collapsed mode */
      #dock.collapsed{
        width:46px !important;
        min-width:46px !important;
        max-width:46px !important;
        overflow:visible !important;
      }

      #dock.collapsed #grab,
      #dock.collapsed #brand,
      #dock.collapsed #host,
      #dock.collapsed #newtab,
      #dock.collapsed #sessions,
      #dock.collapsed #autosend,
      #dock.collapsed #status,
      #dock.collapsed #tabs,
      #dock.collapsed #termwrap,
      #dock.collapsed #footer,
      #dock.collapsed #picker,
      #dock.collapsed #toast{
        display:none !important;
      }

      #dock.collapsed #top{
        display:flex !important;
        flex-direction:column !important;
        align-items:center !important;
        width:46px !important;
        min-width:46px !important;
        height:100% !important;
        min-height:100% !important;
        padding:64px 4px 8px !important;
        gap:9px !important;
        box-sizing:border-box !important;
      }

      #dock.collapsed #health{
        display:flex !important;
        flex-direction:column !important;
        flex-wrap:nowrap !important;
        align-items:center !important;
        gap:9px !important;
      }

      #dock.collapsed #health > span{
        width:26px !important;
        min-width:26px !important;
        height:26px !important;
        padding:0 !important;
        justify-content:center !important;
        overflow:hidden !important;
        font-size:0 !important;
        border-radius:50% !important;
      }

      #dock.collapsed #health > span::before{
        width:9px !important;
        height:9px !important;
        flex-basis:9px !important;
      }


      /* ---------- v0.12.1 TERMINAL POLISH ---------- */

      #termwrap {
        background:#0a0a0a !important;
      }

      .terminal-slot {
        box-sizing:border-box !important;
        padding:7px 5px 5px 7px !important;
        background:#0a0a0a !important;
      }

      /*
       * CHATDOCK_V0125_XTERM_BOXMODEL
       *
       * ChatDock's UI uses border-box globally. xterm performs its
       * own pixel/cell/canvas measurements, so do not add padding or
       * force ChatDock's box model onto renderer internals.
       */
      .xterm {
        height:100% !important;
        padding:0 !important;
        box-sizing:content-box !important;
      }

      .xterm *,
      .xterm *::before,
      .xterm *::after {
        box-sizing:content-box !important;
      }

      /*
       * Belt-and-suspenders protection for the exact DOM layers that
       * would otherwise expose prompt/accessibility text visually.
       */
      .xterm .xterm-helper-textarea,
      .xterm-char-measure-element,
      .xterm .xterm-accessibility:not(.debug),
      .xterm .xterm-message,
      .xterm .live-region {
        position:absolute !important;
        left:-9999em !important;
      }

      .xterm-screen {
        border-radius:4px;
      }

      .xterm-viewport {
        background:#0a0a0a !important;

        scrollbar-width:thin;
        scrollbar-color:
          rgba(255,255,255,.18)
          transparent;
      }

      .xterm-viewport::-webkit-scrollbar {
        width:7px;
      }

      .xterm-viewport::-webkit-scrollbar-thumb {
        background:
          rgba(255,255,255,.18);

        border-radius:999px;
      }

      .xterm-helper-textarea {
        opacity:0 !important;
      }

      #tabs {
        padding:
          6px
          7px
          4px !important;

        gap:5px !important;
      }

      #tabs button,
      #tabs .tab {
        border-radius:7px !important;
      }

      #footer {
        min-height:34px;
        padding:
          5px
          7px !important;

        gap:5px !important;
      }



      /* CHATDOCK_V0122_REVEAL_CSS */

      .terminal-slot {
        opacity:0;
        transition:opacity 90ms ease-out;
      }

      .terminal-slot.chatdock-terminal-ready {
        opacity:1;
      }

`;

    shadow.appendChild(css);

    /* Remove literal bullet; CSS renders the glowing LED. */
    for(const id of ["health-native","health-zaku","health-canavar"]){
      const el=shadow.getElementById(id);
      if(el) el.textContent=el.textContent.replace(/^●\s*/,"");
    }

    const handle=document.createElement("button");
    handle.id="chatdock-collapse-handle";
    handle.type="button";

    const syncHandle=()=>{
      const collapsed=dock.classList.contains("collapsed");
      handle.textContent=collapsed ? "‹" : "›";
      handle.title=collapsed ? "ChatDock'u aç" : "ChatDock'u küçült";
    };

    handle.addEventListener("click",()=>{
      STATE.collapsed=!dock.classList.contains("collapsed");
      dock.classList.toggle("collapsed",STATE.collapsed);
      syncHandle();

      try{ saveMeta(); }catch(_){}

      if(!STATE.collapsed){
        const t=active();
        if(t){
          requestAnimationFrame(()=>{
            try{fit(t)}catch(_){}
            try{t.term.focus()}catch(_){}
          });
        }
      }
    });

    dock.appendChild(handle);

    new MutationObserver(syncHandle).observe(
      dock,
      {attributes:true,attributeFilter:["class"]}
    );

    syncHandle();
  })();



  const HEALTH_COLORS = {
    ok: "#43d17d",
    bad: "#ff6470",
    checking: "#8b95a7"
  };

  function healthMark(
    name,
    value,
    detail = ""
  ) {
    const el =
      shadow.getElementById(
        `health-${name}`
      );

    if (!el)
      return;

    const state =
      value === true
        ? "ok"
        : value === false
          ? "bad"
          : "checking";

    el.dataset.state = state;
    el.style.color =
      HEALTH_COLORS[state];

    if (detail)
      el.title = detail;
  }

  function resetHealth(
    value = null,
    detail = ""
  ) {
    for (
      const name
      of ["native", "zaku", "canavar"]
    ) {
      healthMark(
        name,
        value,
        detail
      );
    }
  }

  function applyHealth(msg) {
    healthMark(
      "native",
      msg?.native?.ok === true,
      msg?.native?.version
        ? `Native Messaging v${msg.native.version}`
        : "Native Messaging"
    );

    healthMark(
      "zaku",
      msg?.zaku?.ok === true,
      msg?.zaku?.host
        ? `Zaku: ${msg.zaku.host}`
        : "Zaku"
    );

    healthMark(
      "canavar",
      msg?.canavar?.ok === true,
      msg?.canavar?.ok
        ? (
            msg?.canavar?.host
              ? `Canavar: ${msg.canavar.host}`
              : "Canavar SSH erişilebilir"
          )
        : (
            msg?.canavar?.error
            || "Canavar SSH erişilemiyor"
          )
    );
  }

  function requestHealth() {
    if (!STATE.bridge)
      return;

    send({
      type: "health"
    });
  }

  function syncRail() {

    dock.classList.toggle(
      "collapsed",
      !!STATE.collapsed
    );

    const b =
      shadow.getElementById(
        "hide"
      );

    if (b) {

      b.title =
        STATE.collapsed
          ? "ChatDock'u aç"
          : "Sidebar'a küçült";
    }

    if (!STATE.collapsed) {

      const t =
        active();

      if (t) {

        requestAnimationFrame(
          () => fit(t)
        );
      }
    }
  }


  function toast(s) {

    const el =
      shadow.getElementById(
        "toast"
      );

    el.textContent =
      s;

    el.style.display =
      "block";

    clearTimeout(
      toast._t
    );

    toast._t =
      setTimeout(
        () =>
          el.style.display =
            "none",
        2200
      );
  }


  function status(s) {

    shadow
      .getElementById(
        "status"
      )
      .textContent =
      s;
  }


  function send(msg) {

    try {
      port.postMessage(
        msg
      );
    }

    catch (_) {
      status(
        "bridge yok"
      );
    }
  }


  function fit(t) {

    const r =
      t.slot
        .getBoundingClientRect();

    if (
      r.width < 20 ||
      r.height < 20
    )
      return;

    const cols =
      Math.max(
        40,
        Math.floor(
          (r.width - 18)
          /
          7.8
        )
      );

    const rows =
      Math.max(
        10,
        Math.floor(
          (r.height - 18)
          /
          16.4
        )
      );

    if (
      t.term.cols !== cols
      ||
      t.term.rows !== rows
    ) {

      try {
        t.term.resize(
          cols,
          rows
        );
      }
      catch (_) {}

      send({
        type: "resize",
        session: t.id,
        cols,
        rows
      });
    }
  }


  function active() {

    return STATE
      .terminals
      .get(
        STATE.activeId
      );
  }


  function renderTabs() {

    const bar =
      shadow.getElementById(
        "tabs"
      );

    bar.textContent =
      "";

    for (
      const t
      of STATE.tabs
    ) {

      const e =
        document.createElement(
          "div"
        );

      e.className =
        "tab"
        +
        (
          t.id ===
          STATE.activeId
            ? " active"
            : ""
        );

      e.title =
        `${t.host} / tmux: ${t.tmux}`;

      const labelSpan =
        document.createElement(
          "span"
        );

      labelSpan.textContent =
        t.label;

      const closeSpan =
        document.createElement(
          "span"
        );

      closeSpan.className =
        "x";

      closeSpan.textContent =
        "×";

      e.replaceChildren(
        labelSpan,
        closeSpan
      );

      e.addEventListener(
        "click",
        ev => {

          if (
            ev.target
              .classList
              .contains("x")
          ) {

            closeTab(
              t.id
            );
          }

          else {

            activate(
              t.id
            );
          }
        }
      );

      bar.appendChild(
        e
      );
    }
  }


  function activate(id) {

    STATE.activeId =
      id;

    for (
      const [tid, t]
      of STATE.terminals
    ) {

      t.slot
        .classList
        .toggle(
          "active",
          tid === id
        );
    }

    const t =
      STATE.terminals.get(
        id
      );

    if (t) {

      shadow
        .getElementById(
          "host"
        )
        .value =
        t.host;

      requestAnimationFrame(
        () => {

          fit(t);

          t.term.focus();
        }
      );
    }

    renderTabs();

    saveMeta();
  }


  const CHATDOCK_V0112_CLEAN_ATTACH = true;

  /*
   * v0.12.1 attach-noise guard.
   *
   * Some tmux/PTY capability negotiation can leak a short visual
   * probe line during the first repaint. We only filter extremely
   * characteristic garbage during a short startup window.
   * Normal terminal output is untouched.
   */
  function cleanAttachNoise(
    t,
    value
  ) {
    const raw =
      String(value || "");

    if (
      !t?.attachCleanUntil
      ||
      Date.now() >
        t.attachCleanUntil
    ) {
      return raw;
    }

    const pieces =
      raw.split(
        /(\r\n|\n|\r)/
      );

    return pieces
      .map(
        piece => {
          if (
            piece === "\n"
            ||
            piece === "\r"
            ||
            piece === "\r\n"
          ) {
            return piece;
          }

          const visible =
            stripAnsi(piece)
              .replace(
                /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,
                ""
              )
              .trim();

          if (
            visible.length >= 10
            &&
            (
              /^[i~$><^?_=+\-|\\/]+$/.test(
                visible
              )
              ||
              /^i{10,}~*$/.test(
                visible
              )
              ||
              /^~{10,}$/.test(
                visible
              )
            )
          ) {
            return "";
          }

          return piece;
        }
      )
      .join("");
  }


  // CHATDOCK_V0124_STABLE_GEOMETRY
  async function waitForStableTerminalGeometry(
    t,
    timeoutMs = 900
  ) {
    const started=Date.now();

    let last="";
    let stable=0;

    while (
      Date.now()-started <
      timeoutMs
    ) {
      try {
        fit(t);
      }
      catch (_) {}

      const now=
        `${t.term.cols}x${t.term.rows}`;

      if (now === last) {
        stable += 1;
      }
      else {
        last=now;
        stable=0;
      }

      /*
       * Four identical samples ~45ms apart means layout,
       * mission bar and tab strip have settled.
       */
      if (stable >= 3) {
        return;
      }

      await sleep(45);
    }

    try {
      fit(t);
    }
    catch (_) {}
  }


  function makeTerminal(
    meta
  ) {

    if (
      STATE.terminals
        .has(meta.id)
    )
      return;

    const slot =
      document.createElement(
        "div"
      );

    slot.className =
      "terminal-slot";

    shadow
      .getElementById(
        "termwrap"
      )
      .appendChild(
        slot
      );


    const term =
      new Terminal({

        cursorBlink: true,

        /*
         * CHATDOCK_V0121_TERMINAL_POLISH
         *
         * Most ordinary command output uses LF rather than CRLF.
         * xterm's default convertEol=false keeps the previous
         * horizontal cursor column on every LF, producing the
         * diagonal / drifting text visible in the dock.
         */
        convertEol: true,

        cursorStyle: "bar",
        cursorWidth: 2,

        fontWeight: "400",
        fontWeightBold: "600",

        letterSpacing: 0,

        scrollOnUserInput: true,

        fontFamily:
          '"DejaVu Sans Mono",' +
          '"Liberation Mono",' +
          'monospace',

        fontSize: 13,

        lineHeight: 1.18,

        scrollback: 12000,

        theme: {
          background:
            "#0b0b0b",
          foreground:
            "#e6e6e6",
          cursor:
            "#e6e6e6"
        }
      });


    term.open(
      slot
    );



    const t = {
      ...meta,
      term,
      slot,

      /*
       * Only the first attach/repaint gets filtering.
       * 2.5 seconds is enough for tmux capability negotiation.
       */
      attachCleanUntil:
        Date.now() + 2500,

      // CHATDOCK_V0122_VISUAL_ATTACH
      attachVisualReady: false,
      redrawFallbackTimer: null

    };


    STATE.terminals.set(
      meta.id,
      t
    );


    term.onData(
      data =>
        send({
          type: "input",
          session:
            meta.id,
          data
        })
    );


    term.onResize(
      ({
        cols,
        rows
      }) =>
        send({
          type: "resize",
          session:
            meta.id,
          cols,
          rows
        })
    );


    /*
     * CHATDOCK_V0112_DEFERRED_OPEN
     *
     * xterm starts at its generic 80x24 geometry.
     * Do not attach tmux at that fake size and resize it
     * immediately afterwards. Fit to the actual dock first.
     */
    /*
     * v0.12.4:
     * do not attach during an intermediate browser layout size.
     */
    (async () => {
      await waitForStableTerminalGeometry(
        t
      );

      send({
        type: "open",
        session: meta.id,
        host: meta.host,
        tmux: meta.tmux,
        cols: term.cols,
        rows: term.rows
      });
    })();
  }


  function nextN(host) {

    const nums =
      STATE.tabs
        .filter(
          t =>
            t.host === host
            &&
            !t.attached
        )
        .map(
          t =>
            Number(t.n)
            ||
            0
        );

    let n = 1;

    while (
      nums.includes(n)
    )
      n++;

    return n;
  }


  function addOwned(
    host = "zaku"
  ) {

    const n =
      nextN(host);

    const tmux =
      tmuxName(
        host,
        n
      );

    const id =
      `view_${STATE.shortId}_${host}_${n}_` +
      Math.random()
        .toString(36)
        .slice(2, 8);

    const meta = {

      id,

      host,

      n,

      tmux,

      label:
        tabLabel(
          host,
          n
        ),

      attached:
        false
    };


    STATE.tabs.push(
      meta
    );

    makeTerminal(
      meta
    );

    activate(
      id
    );

    saveMeta();
  }


  async function attachExisting(
    host,
    tmux
  ) {

    const labels =
      await knownLabels();

    const label =
      labels.get(
        `${host}:${tmux}`
      )
      ||
      (
        `${sanitize(tmux, 22)} · ` +
        `${
          host === "zaku"
            ? "Z"
            : "C"
        }`
      );


    const id =
      `attach_${host}_${slug(tmux, 30)}_` +
      Math.random()
        .toString(36)
        .slice(2, 8);


    const meta = {

      id,

      host,

      n: 0,

      tmux,

      label,

      attached: true
    };


    STATE.tabs.push(
      meta
    );

    makeTerminal(
      meta
    );

    activate(
      id
    );

    saveMeta();


    shadow
      .getElementById(
        "picker"
      )
      .classList
      .remove(
        "open"
      );
  }


  function closeTab(id) {

    const t =
      STATE.terminals
        .get(id);

    if (t) {

      send({
        type: "close",
        session: id
      });

      try {
        t.term.dispose();
      }
      catch (_) {}

      t.slot.remove();

      STATE.terminals
        .delete(id);
    }


    STATE.tabs =
      STATE.tabs.filter(
        x =>
          x.id !== id
      );


    if (
      !STATE.tabs.length
    ) {

      addOwned(
        "zaku"
      );

      return;
    }


    if (
      STATE.activeId === id
    ) {

      STATE.activeId =
        STATE.tabs[0].id;
    }


    activate(
      STATE.activeId
    );

    saveMeta();
  }


  function stripAnsi(
    text
  ) {

    return String(text)
      .replace(
        /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
        ""
      )
      .replace(
        /\r/g,
        ""
      )
      .replace(
        /\u0008/g,
        ""
      );
  }


  function composer() {

    return (
      document.querySelector(
        "#prompt-textarea"
      )
      ||
      document.querySelector(
        'textarea[data-testid="prompt-textarea"]'
      )
      ||
      document.querySelector(
        "textarea"
      )
      ||
      document.querySelector(
        '[contenteditable="true"]'
      )
    );
  }


  function composerText(el) {

    if (!el)
      return "";

    return (
      el.tagName ===
      "TEXTAREA"
        ? el.value
        : (
            el.innerText
            ||
            el.textContent
            ||
            ""
          )
    );
  }


  function insertComposer(
    text
  ) {

    const el =
      composer();

    if (!el) {

      toast(
        "Chat giriş alanı bulunamadı"
      );

      return false;
    }


    el.focus();


    if (
      el.tagName ===
      "TEXTAREA"
    ) {

      el.value =
        text;

      el.dispatchEvent(
        new Event(
          "input",
          {
            bubbles: true
          }
        )
      );
    }

    else {

      try {

        const sel =
          window.getSelection();

        const range =
          document.createRange();

        range.selectNodeContents(
          el
        );

        range.deleteContents();

        const tn =
          document.createTextNode(
            text
          );

        range.insertNode(
          tn
        );

        range.setStartAfter(
          tn
        );

        range.collapse(
          true
        );

        sel.removeAllRanges();

        sel.addRange(
          range
        );
      }

      catch (_) {

        document.execCommand(
          "selectAll",
          false,
          null
        );

        document.execCommand(
          "insertText",
          false,
          text
        );
      }


      el.dispatchEvent(
        new InputEvent(
          "input",
          {
            bubbles: true,
            inputType:
              "insertText",
            data: text
          }
        )
      );
    }


    return true;
  }


  async function submitComposer() {

    for (
      let i = 0;
      i < 40;
      i++
    ) {

      const b =
        document.querySelector(
          'button[data-testid="send-button"]'
        )
        ||
        document.querySelector(
          'button[aria-label="Send prompt"]'
        )
        ||
        document.querySelector(
          'button[aria-label="Gönder"]'
        )
        ||
        document.querySelector(
          'button[aria-label*="Send"]'
        )
        ||
        document.querySelector(
          'button[aria-label*="Gönder"]'
        );


      if (
        b &&
        !b.disabled
      ) {

        b.click();

        return true;
      }


      await sleep(
        150
      );
    }


    const el =
      composer();

    const form =
      el?.closest(
        "form"
      );


    if (
      form?.requestSubmit
    ) {

      try {

        form.requestSubmit();

        return true;
      }

      catch (_) {}
    }


    return false;
  }


  function runCode(text) {

    const t =
      active();

    if (!t) {

      toast(
        "Aktif terminal yok"
      );

      return;
    }


    const script =
      String(text)
        .replace(
          /\r\n/g,
          "\n"
        )
        .replace(
          /\r/g,
          "\n"
        )
        .trimEnd();


    if (
      !script.trim()
    )
      return;

    missionObserveRun(
      script
    );


    const runId =
      (
        crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random()}`
      )
        .replace(
          /[^A-Za-z0-9]/g,
          ""
        );


    STATE.runs.set(
      runId,
      {

        session:
          t.id,

        host:
          t.host,

        command:
          script,

        output:
          "",

        composerWasEmpty:
          !composerText(
            composer()
          ).trim()
      }
    );


    t.term.write(
      `\r\n\x1b[96m` +
      `[RUN ▶ ${t.host.toUpperCase()}]` +
      `\x1b[0m\r\n`
    );


    send({
      type: "exec",
      session:
        t.id,
      run_id:
        runId,
      script
    });


    status(
      `${t.host} çalışıyor`
    );
  }


  async function handleRun(
    msg
  ) {

    const r =
      STATE.runs.get(
        msg.run_id
      );

    if (!r)
      return;


    const t =
      STATE.terminals.get(
        r.session
      );


    if (
      msg.type ===
      "exec_started"
    ) {

      if (t) {

        t.term.write(
          `\x1b[90m` +
          `[cwd: ${msg.cwd || "?"}]` +
          `\x1b[0m\r\n`
        );
      }

      return;
    }


    if (
      msg.type ===
      "exec_output"
    ) {

      const chunk =
        String(
          msg.data || ""
        );

      r.output +=
        chunk;


      if (
        r.output.length >
        40000
      ) {

        r.output =
          r.output.slice(
            -40000
          );
      }


      if (t)
        t.term.write(
          chunk
        );

      return;
    }


    if (
      msg.type !==
      "exec_done"
    )
      return;


    const code =
      Number.isInteger(
        msg.code
      )
        ? msg.code
        : 125;


    if (t) {

      t.term.write(
        `\r\n\x1b[96m` +
        `[RUN ■ exit ${code}]` +
        `\x1b[0m\r\n`
      );
    }


    status(
      `${r.host} bağlı`
    );


    let out =
      stripAnsi(
        r.output
      ).trim();


    if (msg.error) {

      out +=
        (
          out
            ? "\n"
            : ""
        )
        +
        `ChatDock error: ${msg.error}`;
    }


    if (!out) {

      out =
        "(command produced no output)";
    }


    let truncated =
      false;


    if (
      out.length >
      18000
    ) {

      out =
        out.slice(
          -18000
        );

      truncated =
        true;
    }


    missionRunFinished(
      r,
      code,
      out
    );

    const payload =
      `[ChatDock run result]\n` +
      `Host: ${r.host}\n` +
      `Terminal: ${t?.label || r.session}\n` +
      `Exit code: ${code}\n` +
      (
        truncated
          ? "Output: last 18000 characters (truncated)\n"
          : ""
      ) +
      `\n${out}`;


    STATE.runs.delete(
      msg.run_id
    );


    if (
      !STATE.autoSend
    ) {

      toast(
        `Run bitti — exit ${code}`
      );

      return;
    }


    if (
      !r.composerWasEmpty
      ||
      composerText(
        composer()
      ).trim()
    ) {

      toast(
        "Run bitti; mesaj kutusu dolu olduğu için auto-send yapılmadı"
      );

      return;
    }


    if (
      !insertComposer(
        payload
      )
    )
      return;


    await sleep(
      250
    );


    const ok =
      await submitComposer();


    toast(
      ok
        ? `Çıktı gönderildi — exit ${code}`
        : "Çıktı eklendi; Send bulunamadı"
    );
  }


  function lastLines(n) {

    const t =
      active();

    if (!t)
      return "";


    const b =
      t.term.buffer.active;


    const start =
      Math.max(
        0,
        b.length - n
      );


    const lines = [];


    for (
      let i = start;
      i < b.length;
      i++
    ) {

      lines.push(
        b.getLine(i)
          ?.translateToString(
            true
          )
        ||
        ""
      );
    }


    return lines
      .join("\n")
      .trimEnd();
  }


  async function showSessions() {

    const p =
      shadow.getElementById(
        "picker"
      );


    if (
      p.classList.contains(
        "open"
      )
    ) {

      p.classList.remove(
        "open"
      );

      return;
    }


    p.innerHTML =
      "<div style='font-size:11px;color:#aaa;padding:4px'>" +
      "Terminaller taranıyor…" +
      "</div>";


    p.classList.add(
      "open"
    );


    send({
      type:
        "list_sessions"
    });
  }


  async function renderPicker(
    items
  ) {

    const p =
      shadow.getElementById(
        "picker"
      );


    const labels =
      await knownLabels();


    p.textContent =
      "";


    if (
      !items.length
    ) {

      p.innerHTML =
        "<div style='font-size:11px;color:#aaa;padding:4px'>" +
        "Başka tmux session yok." +
        "</div>";

      return;
    }


    for (
      const s
      of items
    ) {

      const row =
        document.createElement(
          "div"
        );

      row.className =
        "pickrow";


      const b =
        document.createElement(
          "button"
        );


      const label =
        labels.get(
          `${s.host}:${s.tmux}`
        )
        ||
        s.tmux;


      b.textContent =
        `${
          s.host === "zaku"
            ? "ZAKU"
            : "CANAVAR"
        } · ${label}`;


      b.title =
        s.tmux;


      b.addEventListener(
        "click",
        () =>
          attachExisting(
            s.host,
            s.tmux
          )
      );


      row.appendChild(
        b
      );


      p.appendChild(
        row
      );
    }
  }



  /*
   * CHATDOCK_V012_MISSION_ENGINE
   *
   * Autonomous browser-side orchestration:
   *
   * user objective
   *   -> mission contract
   *   -> ChatGPT answer
   *   -> exactly one executable code block
   *   -> ChatDock run
   *   -> result automatically returned
   *   -> next ChatGPT step
   *   -> verified completion
   */

  if (!STATE.mission) {
    STATE.mission = {
      auto:
        localStorage.getItem(
          "zaku-chatdock:mission-auto"
        ) !== "0",

      active: false,
      id: "",
      objective: "",
      status: "IDLE",
      step: 0,
      note: "Hazır",

      baselineAssistant: "",
      lastAssistant: "",
      lastRunHash: "",
      dispatchingHash: "",

      failSignature: "",
      failCount: 0,
      protocolErrors: 0,

      maxSteps: 30
    };
  }


  let missionScanTimer = null;


  function missionHash(value) {
    const text =
      String(value || "");

    let h = 2166136261;

    for (
      let i = 0;
      i < text.length;
      i++
    ) {
      h ^= text.charCodeAt(i);

      h = Math.imul(
        h,
        16777619
      );
    }

    return (
      h >>> 0
    ).toString(16);
  }


  function missionStorageKey() {
    let key = "";

    try {
      key =
        conversationInfo()
          ?.chatKey
        || "";
    }
    catch (_) {}

    if (!key) {
      key =
        location.pathname
        || "unknown";
    }

    return (
      "zaku-chatdock:mission:"
      + key
    );
  }


  function missionSave() {
    try {
      localStorage.setItem(
        missionStorageKey(),
        JSON.stringify(
          STATE.mission
        )
      );

      localStorage.setItem(
        "zaku-chatdock:mission-auto",
        STATE.mission.auto
          ? "1"
          : "0"
      );
    }
    catch (_) {}
  }


  function missionRestore() {
    const auto =
      localStorage.getItem(
        "zaku-chatdock:mission-auto"
      ) !== "0";

    try {
      const raw =
        localStorage.getItem(
          missionStorageKey()
        );

      if (raw) {
        const saved =
          JSON.parse(raw);

        if (
          saved
          && typeof saved === "object"
        ) {
          Object.assign(
            STATE.mission,
            saved
          );
        }
      }
    }
    catch (_) {}

    STATE.mission.auto = auto;

    missionRender();
  }


  function missionStatusColor(status) {
    switch (status) {
      case "RUNNING":
        return "#43d17d";

      case "VERIFYING":
        return "#58a6ff";

      case "HUMAN_NEEDED":
        return "#ffbd4a";

      case "BLOCKED":
        return "#ff6470";

      case "DONE":
        return "#8bdc65";

      case "PAUSED":
        return "#b692ff";

      default:
        return "#8b95a7";
    }
  }


  function missionRender() {
    const m =
      STATE.mission;

    const bar =
      shadow.getElementById(
        "missionbar"
      );

    if (!bar)
      return;

    const dot =
      shadow.getElementById(
        "mission-dot"
      );

    const state =
      shadow.getElementById(
        "mission-state"
      );

    const objective =
      shadow.getElementById(
        "mission-objective"
      );

    const step =
      shadow.getElementById(
        "mission-step"
      );

    const note =
      shadow.getElementById(
        "mission-note"
      );

    const auto =
      shadow.getElementById(
        "mission-auto"
      );

    const stop =
      shadow.getElementById(
        "mission-stop"
      );

    if (dot) {
      dot.style.color =
        missionStatusColor(
          m.status
        );
    }

    if (state) {
      state.textContent =
        m.status || "IDLE";
    }

    if (objective) {
      objective.textContent =
        m.objective
          ? m.objective
              .replace(/\s+/g, " ")
              .slice(0, 76)
          : "Mission bekleniyor";
    }

    if (step) {
      step.textContent =
        m.step
          ? `Step ${m.step}`
          : "Step —";
    }

    if (note) {
      note.textContent =
        m.note || "";
    }

    if (auto) {
      auto.textContent =
        m.auto
          ? "MISSION AUTO ON"
          : "MISSION AUTO OFF";
    }

    if (stop) {
      stop.disabled =
        !m.active;

      stop.style.opacity =
        m.active
          ? "1"
          : ".45";
    }
  }


  function missionSet(
    status,
    note = ""
  ) {
    STATE.mission.status =
      status;

    if (note) {
      STATE.mission.note =
        note;
    }

    missionSave();
    missionRender();
  }


  function missionLatestAssistant() {
    const nodes =
      document.querySelectorAll(
        '[data-message-author-role="assistant"]'
      );

    return (
      nodes[
        nodes.length - 1
      ]
      || null
    );
  }


  function missionAssistantFingerprint(
    node = missionLatestAssistant()
  ) {
    if (!node)
      return "";

    const text =
      node.innerText
      || node.textContent
      || "";

    const codes =
      [
        ...node.querySelectorAll(
          "pre code"
        )
      ]
      .map(
        el =>
          el.innerText
          || el.textContent
          || ""
      )
      .join("\n---CODE---\n");

    return missionHash(
      text
      + "\n---\n"
      + codes
    );
  }


  function missionAssistantBusy() {
    return !!(
      document.querySelector(
        'button[data-testid="stop-button"]'
      )
      ||
      document.querySelector(
        'button[aria-label*="Stop"]'
      )
      ||
      document.querySelector(
        'button[aria-label*="Durdur"]'
      )
    );
  }


  function missionDangerousScript(
    script
  ) {
    const rules = [
      /rm\s+-[^\n]*r[^\n]*f[^\n]*(?:\/(?:\s|$)|--no-preserve-root)/i,
      /\bmkfs(?:\.[A-Za-z0-9]+)?\b/i,
      /\bwipefs\b/i,
      /\bdd\b[^\n]*\bof=\/dev\//i,
      /\bcryptsetup\s+luksFormat\b/i,
      /\b(?:shutdown|poweroff|reboot)\b/i
    ];

    return rules.some(
      rx => rx.test(script)
    );
  }


  function missionBypassText(text) {
    const x =
      String(text || "")
        .trimStart();

    return (
      x.startsWith(
        "[ChatDock run result]"
      )
      ||
      x.startsWith(
        "[CHATDOCK_RESULT"
      )
      ||
      x.startsWith(
        "[CHATDOCK_MISSION"
      )
    );
  }


  function missionContract(
    objective,
    mode = "NEW"
  ) {
    const t =
      active();

    const host =
      t?.host || "zaku";

    const missionId =
      STATE.mission.id;

    const header =
      mode === "NEW"
        ? "[CHATDOCK_MISSION v1]"
        : "[CHATDOCK_MISSION_UPDATE v1]";

    return [
      header,

      `mission_id: ${missionId}`,

      `objective: ${objective}`,

      `active_host: ${host}`,

      "",

      "Operating contract:",

      "1. Own the objective and drive it to a verified completion.",

      "2. ChatDock is available as the terminal execution loop. When terminal work is required, return exactly ONE self-contained executable shell code block for the active host.",

      "3. Prefer inspect -> act -> verify -> continue. Do not stop after merely suggesting commands when execution through ChatDock can advance the objective.",

      "4. ChatDock automatically runs the executable block and returns the run result to you. Read that result and continue with the next necessary step without asking the user to relay routine output.",

      "5. Never claim success unless the returned execution result or another explicit verification proves it.",

      "6. If work belongs on the other machine, route through the existing ssh aliases (zaku/canavar) from the active host when practical rather than asking the user to switch terminals.",

      "7. Ask the user only for irreducible human actions: credentials/2FA, physical interaction, purchase/payment, external communication, a genuinely ambiguous choice, or an irreversible/destructive action requiring approval.",

      '8. If human action is required, include the literal marker "[CHATDOCK_HUMAN_NEEDED]" and explain the minimum required action. Do not provide an auto-runnable destructive block.',

      '9. If the objective cannot progress, include "[CHATDOCK_BLOCKED]" and explain the blocker.',

      '10. After EVERY executable code block, immediately add a very short line beginning "Durum:" summarizing what this step is doing or what will be verified. Maximum two short sentences.',

      "11. When the objective is verified complete, give a concise completion summary and return NO executable code block.",

      "12. Do not ask the user to copy terminal output, paste commands, or manually send routine run results. ChatDock owns that loop.",

      "",

      "Begin or continue the mission now."
    ].join("\n");
  }


  async function missionSubmitUserText(
    text
  ) {
    const raw =
      String(text || "")
        .trim();

    if (!raw)
      return false;

    const m =
      STATE.mission;

    const resume =
      !!m.objective
      &&
      (
        m.active
        ||
        [
          "HUMAN_NEEDED",
          "BLOCKED",
          "PAUSED"
        ].includes(
          m.status
        )
      );

    if (!resume) {
      m.id =
        (
          crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random()}`
        )
        .replace(
          /[^A-Za-z0-9]/g,
          ""
        )
        .slice(0, 24);

      m.objective = raw;
      m.step = 0;

      m.lastRunHash = "";
      m.dispatchingHash = "";

      m.failSignature = "";
      m.failCount = 0;

      m.protocolErrors = 0;
    }

    else {
      m.note =
        "Kullanıcı mission'a ek bilgi verdi";
    }

    m.active = true;
    m.status = "RUNNING";

    m.baselineAssistant =
      missionAssistantFingerprint();

    m.lastAssistant =
      m.baselineAssistant;

    missionSave();
    missionRender();

    const prompt =
      missionContract(
        resume
          ? (
              m.objective
              + "\n\nUser update: "
              + raw
            )
          : raw,
        resume
          ? "UPDATE"
          : "NEW"
      );

    if (
      !insertComposer(
        prompt
      )
    ) {
      missionSet(
        "BLOCKED",
        "Mission contract composer'a yazılamadı"
      );

      m.active = false;
      missionSave();
      missionRender();

      return false;
    }

    await sleep(80);

    const ok =
      await submitComposer();

    if (!ok) {
      m.active = false;

      missionSet(
        "BLOCKED",
        "Mission mesajı gönderilemedi"
      );

      return false;
    }

    m.note =
      resume
        ? "Mission devam ediyor"
        : "Mission ChatGPT'ye verildi";

    missionSave();
    missionRender();

    return true;
  }


  async function missionProtocolCorrection(
    reason
  ) {
    const m =
      STATE.mission;

    m.protocolErrors =
      (m.protocolErrors || 0)
      + 1;

    if (
      m.protocolErrors >= 3
    ) {
      m.active = false;

      missionSet(
        "BLOCKED",
        "Mission protokolü 3 kez ihlal edildi"
      );

      return;
    }

    const el =
      composer();

    if (
      composerText(el)
        .trim()
    ) {
      m.active = false;

      missionSet(
        "HUMAN_NEEDED",
        "Composer dolu; otomatik protokol düzeltmesi durdu"
      );

      return;
    }

    const payload = [
      "[CHATDOCK_MISSION_PROTOCOL v1]",

      `mission_id: ${m.id}`,

      `problem: ${reason}`,

      "",

      "Continue the same mission.",

      "If terminal execution is needed, return exactly ONE executable shell code block, followed immediately by a short 'Durum:' line.",

      "If no terminal execution is needed and the objective is complete, return the verified completion summary with no code block."
    ].join("\n");

    if (
      !insertComposer(
        payload
      )
    )
      return;

    missionSet(
      "VERIFYING",
      "ChatGPT'den tek-adım mission formatı isteniyor"
    );

    await sleep(120);
    await submitComposer();
  }


  function missionObserveRun(
    script
  ) {
    const m =
      STATE.mission;

    if (!m?.active)
      return;

    const hash =
      missionHash(script);

    if (
      m.dispatchingHash
      &&
      m.dispatchingHash ===
        hash
    ) {
      m.dispatchingHash = "";
      missionSave();
      return;
    }

    m.lastRunHash =
      hash;

    m.step =
      (m.step || 0)
      + 1;

    missionSet(
      "RUNNING",
      `Step ${m.step} çalışıyor`
    );
  }


  function missionRunFinished(
    run,
    code,
    output
  ) {
    const m =
      STATE.mission;

    if (!m?.active)
      return;

    if (code !== 0) {
      const signature =
        missionHash(
          String(code)
          + "|"
          + String(
              run?.command || ""
            )
          + "|"
          + String(
              output || ""
            ).slice(-1200)
        );

      if (
        signature ===
        m.failSignature
      ) {
        m.failCount =
          (m.failCount || 0)
          + 1;
      }

      else {
        m.failSignature =
          signature;

        m.failCount = 1;
      }

      if (
        m.failCount >= 3
      ) {
        m.active = false;

        missionSet(
          "BLOCKED",
          "Aynı hata 3 kez tekrarlandı; otomatik döngü durduruldu"
        );

        return;
      }
    }

    else {
      m.failSignature = "";
      m.failCount = 0;
    }

    missionSet(
      "VERIFYING",
      `Step ${m.step} bitti · exit ${code} · ChatGPT doğruluyor`
    );
  }


  async function missionScan() {
    const m =
      STATE.mission;

    if (
      !m?.active
      ||
      missionAssistantBusy()
    )
      return;

    const assistant =
      missionLatestAssistant();

    if (!assistant)
      return;

    const fingerprint =
      missionAssistantFingerprint(
        assistant
      );

    if (
      !fingerprint
      ||
      fingerprint ===
        m.lastAssistant
      ||
      fingerprint ===
        m.baselineAssistant
    )
      return;

    const text =
      assistant.innerText
      || assistant.textContent
      || "";

    /*
     * Response is considered stable because this scan is
     * debounced after DOM mutations and generation must not
     * currently expose a Stop button.
     */

    if (
      text.includes(
        "[CHATDOCK_HUMAN_NEEDED]"
      )
    ) {
      m.lastAssistant =
        fingerprint;

      m.active = false;

      missionSet(
        "HUMAN_NEEDED",
        "ChatGPT insan müdahalesi bekliyor"
      );

      return;
    }

    if (
      text.includes(
        "[CHATDOCK_BLOCKED]"
      )
    ) {
      m.lastAssistant =
        fingerprint;

      m.active = false;

      missionSet(
        "BLOCKED",
        "ChatGPT mission blocker bildirdi"
      );

      return;
    }

    const codes =
      [
        ...assistant.querySelectorAll(
          "pre code"
        )
      ]
      .map(
        el =>
          (
            el.innerText
            || el.textContent
            || ""
          ).trim()
      )
      .filter(Boolean);

    /*
     * A stable assistant response with no executable code
     * means the contract says the objective is complete.
     */
    if (
      codes.length === 0
    ) {
      m.lastAssistant =
        fingerprint;

      m.active = false;
      m.status = "DONE";
      m.note =
        "Mission tamamlandı";

      missionSave();
      missionRender();

      return;
    }

    if (
      codes.length !== 1
    ) {
      m.lastAssistant =
        fingerprint;

      await missionProtocolCorrection(
        `Assistant ${codes.length} code blocks returned; exactly one is required.`
      );

      return;
    }

    const script =
      codes[0];

    const runHash =
      missionHash(script);

    if (
      runHash ===
      m.lastRunHash
    ) {
      m.lastAssistant =
        fingerprint;

      missionSave();
      return;
    }

    if (
      missionDangerousScript(
        script
      )
    ) {
      m.lastAssistant =
        fingerprint;

      m.active = false;

      missionSet(
        "HUMAN_NEEDED",
        "Riskli/oturum kesici komut otomatik çalıştırılmadı"
      );

      return;
    }

    if (
      STATE.runs.size > 0
    )
      return;

    if (
      (m.step || 0) >=
      (m.maxSteps || 30)
    ) {
      m.lastAssistant =
        fingerprint;

      m.active = false;

      missionSet(
        "BLOCKED",
        `Mission ${m.maxSteps || 30} adım sınırına ulaştı`
      );

      return;
    }

    m.lastAssistant =
      fingerprint;

    m.lastRunHash =
      runHash;

    m.dispatchingHash =
      runHash;

    m.step =
      (m.step || 0)
      + 1;

    m.status =
      "RUNNING";

    m.note =
      `Step ${m.step} otomatik çalıştırılıyor`;

    missionSave();
    missionRender();

    runCode(script);
  }


  function missionScheduleScan() {
    clearTimeout(
      missionScanTimer
    );

    missionScanTimer =
      setTimeout(
        missionScan,
        2400
      );
  }


  /*
   * Compact mission status bar.
   * It lives outside the historical top grid so it cannot
   * re-introduce the dock overflow bug fixed in v0.11.1.
   */

  (() => {
    if (
      shadow.getElementById(
        "missionbar"
      )
    )
      return;

    const bar =
      document.createElement(
        "div"
      );

    bar.id =
      "missionbar";

    bar.innerHTML = `
      <span id="mission-dot">●</span>
      <strong id="mission-state">IDLE</strong>
      <span id="mission-step">Step —</span>
      <span id="mission-objective">Mission bekleniyor</span>
      <span id="mission-note"></span>
      <button id="mission-auto">MISSION AUTO ON</button>
      <button id="mission-stop">Stop</button>
    `;

    const style =
      document.createElement(
        "style"
      );

    style.textContent = `
      #missionbar {
        min-height: 34px;
        box-sizing: border-box;

        display: flex;
        align-items: center;
        gap: 7px;

        padding: 5px 8px;

        border-bottom:
          1px solid rgba(255,255,255,.08);

        background:
          rgba(10,10,10,.96);

        font-size: 10px;
        line-height: 16px;

        overflow: hidden;
      }

      #mission-dot {
        font-size: 15px;
        flex: 0 0 auto;
      }

      #mission-state,
      #mission-step {
        flex: 0 0 auto;
      }

      #mission-objective {
        min-width: 50px;
        flex: 1 1 auto;

        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        opacity: .92;
      }

      #mission-note {
        min-width: 0;
        max-width: 190px;

        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        opacity: .62;
      }

      #missionbar button {
        flex: 0 0 auto;

        padding:
          3px
          6px !important;

        min-height: 23px;

        font-size:
          9px !important;
      }

      #dock.collapsed #missionbar {
        display: none !important;
      }
    `;

    shadow.appendChild(
      style
    );

    const top =
      shadow.getElementById(
        "top"
      );

    top.insertAdjacentElement(
      "afterend",
      bar
    );

    shadow
      .getElementById(
        "mission-auto"
      )
      .addEventListener(
        "click",
        () => {
          STATE.mission.auto =
            !STATE.mission.auto;

          missionSave();
          missionRender();
        }
      );

    shadow
      .getElementById(
        "mission-stop"
      )
      .addEventListener(
        "click",
        () => {
          if (
            !STATE.mission.active
          )
            return;

          STATE.mission.active =
            false;

          missionSet(
            "PAUSED",
            "Mission kullanıcı tarafından durduruldu"
          );
        }
      );

    missionRender();
  })();


  /*
   * Intercept ordinary ChatGPT sends while MISSION AUTO is ON.
   * Run-result / mission-protocol messages bypass interception.
   */

  document.addEventListener(
    "click",
    ev => {
      if (
        !STATE.mission.auto
      )
        return;

      const target =
        ev.target;

      const button =
        target?.closest
          ? target.closest(
              'button[data-testid="send-button"],'
              + 'button[aria-label="Send prompt"],'
              + 'button[aria-label="Gönder"],'
              + 'button[aria-label*="Send"],'
              + 'button[aria-label*="Gönder"]'
            )
          : null;

      if (!button)
        return;

      const text =
        composerText(
          composer()
        ).trim();

      if (
        !text
        ||
        missionBypassText(text)
      )
        return;

      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();

      missionSubmitUserText(
        text
      );
    },
    true
  );


  document.addEventListener(
    "keydown",
    ev => {
      if (
        !STATE.mission.auto
        ||
        ev.key !== "Enter"
        ||
        ev.shiftKey
        ||
        ev.ctrlKey
        ||
        ev.altKey
        ||
        ev.metaKey
        ||
        ev.isComposing
      )
        return;

      const el =
        composer();

      if (
        !el
        ||
        !(
          ev.target === el
          ||
          el.contains?.(
            ev.target
          )
        )
      )
        return;

      const text =
        composerText(el)
          .trim();

      if (
        !text
        ||
        missionBypassText(text)
      )
        return;

      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();

      missionSubmitUserText(
        text
      );
    },
    true
  );


  /*
   * Debounced assistant-response watcher.
   */

  new MutationObserver(
    missionScheduleScan
  ).observe(
    document.documentElement,
    {
      subtree: true,
      childList: true,
      characterData: true
    }
  );


  /*
   * Restore per-chat mission state after conversation metadata
   * has had time to initialise.
   */

  setTimeout(
    () => {
      missionRestore();
      missionScheduleScan();
    },
    900
  );


  function installCodeButtons() {

    document
      .querySelectorAll(
        "pre"
      )
      .forEach(
        pre => {

          const role =
            pre.closest(
              '[data-message-author-role]'
            );


          if (
            !role
            ||
            role.getAttribute(
              "data-message-author-role"
            )
            !==
            "assistant"
          )
            return;


          const container =
            pre.parentElement;


          if (
            !container
            ||
            container.querySelector(
              ".chatdock-code-btn"
            )
          )
            return;


          const code =
            pre.querySelector(
              "code"
            );


          if (!code)
            return;


          if (
            getComputedStyle(
              container
            ).position
            ===
            "static"
          ) {

            container.style.position =
              "relative";
          }


          const b =
            document.createElement(
              "button"
            );


          b.className =
            "chatdock-code-btn";


          b.textContent =
            "▶ Çalıştır + Gönder";


          b.title =
            "Aktif terminalin dizininde çalıştır; bitince çıktıyı ChatGPT'ye otomatik gönder";


          b.addEventListener(
            "click",
            ev => {

              ev.stopPropagation();

              runCode(
                code.innerText
                ||
                code.textContent
                ||
                ""
              );
            }
          );


          container.appendChild(
            b
          );
        }
      );
  }


  port.onMessage.addListener(
    msg => {

      /*
       * v0.11 health observer.
       * Existing ChatDock message flow continues below.
       */

      if (
        msg?.__chatdock_ctl ===
        "open"
      ) {
        healthMark(
          "native",
          true,
          "Native Messaging bağlı"
        );

        healthMark(
          "zaku",
          null,
          "Zaku kontrol ediliyor"
        );

        healthMark(
          "canavar",
          null,
          "Canavar kontrol ediliyor"
        );

        queueMicrotask(
          requestHealth
        );
      }

      if (
        msg?.__chatdock_ctl ===
        "close"
      ) {
        resetHealth(
          false,
          msg?.error
            || "Native Messaging bağlantısı kesildi"
        );
      }

      if (
        msg?.type ===
        "health"
      ) {
        applyHealth(msg);
        return;
      }


      if (
        msg?.__chatdock_ctl ===
        "open"
      ) {

        STATE.bridge =
          true;

        status(
          "zaku bağlı"
        );


        for (
          const t
          of STATE.tabs
        ) {

          send({
            type: "open",
            session: t.id,
            host: t.host,
            tmux: t.tmux,
            cols:
              STATE.terminals
                .get(t.id)
                ?.term.cols
              ||
              80,
            rows:
              STATE.terminals
                .get(t.id)
                ?.term.rows
              ||
              24
          });
        }

        return;
      }


      if (
        msg?.__chatdock_ctl ===
        "close"
      ) {

        STATE.bridge =
          false;

        status(
          "bridge yok"
        );

        return;
      }


      if (
        [
          "exec_started",
          "exec_output",
          "exec_done"
        ].includes(
          msg.type
        )
      ) {

        handleRun(
          msg
        );

        return;
      }


      if (
        msg.type ===
        "sessions_list"
      ) {

        STATE.pickerSessions =
          msg.sessions || [];

        renderPicker(
          STATE.pickerSessions
        );

        return;
      }


      const t =
        STATE.terminals.get(
          msg.session
        );


      if (!t)
        return;

      if (
        msg.type ===
        "redrawn"
      ) {
        clearTimeout(
          t.redrawFallbackTimer
        );

        /*
         * refresh-client has now requested a complete tmux repaint.
         * Give the output queue one frame to land before revealing it.
         */
        requestAnimationFrame(
          () => {
            requestAnimationFrame(
              () => {
                t.attachVisualReady =
                  true;

                t.attachCleanUntil =
                  0;

                t.slot.classList.add(
                  "chatdock-terminal-ready"
                );

                try {
                  fit(t);
                }
                catch (_) {}
              }
            );
          }
        );

        return;
      }


      if (
        msg.type ===
        "output"
      ) {
        const terminalData =
          cleanAttachNoise(
            t,
            msg.data
          );

        if (terminalData) {
          t.term.write(
            terminalData
          );
        }

        status(
          `${t.host} bağlı`
        );
      }


      else if (
        msg.type ===
        "opened"
      ) {
        /*
         * v0.12.2:
         * discard the transient xterm visual state created while
         * tmux and xterm negotiate capabilities, then ask tmux for
         * a complete repaint from its clean pane buffer.
         */
        t.attachVisualReady =
          false;

        t.slot.classList.remove(
          "chatdock-terminal-ready"
        );

        try {
          t.term.reset();
        }
        catch (_) {}

        requestAnimationFrame(
          () => {
            fit(t);

            send({
              type: "redraw",
              session: t.id
            });
          }
        );

        clearTimeout(
          t.redrawFallbackTimer
        );

        t.redrawFallbackTimer =
          setTimeout(
            () => {
              /*
               * Never leave a terminal invisible if refresh-client
               * fails for an unusual tmux version.
               */
              t.attachVisualReady =
                true;

              t.slot.classList.add(
                "chatdock-terminal-ready"
              );
            },
            900
          );

        healthMark(
          t.host,
          true,
          `${t.host} terminal bağlantısı açık`
        );

        status(
          `${t.host} bağlı`
        );
      }


      else if (
        msg.type ===
        "exit"
      ) {

        t.term.write(
          "\r\n" +
          "\x1b[31m" +
          "[ChatDock client detached]" +
          "\x1b[0m\r\n"
        );
      }


      else if (
        msg.type ===
        "error"
      ) {

        t.term.write(
          "\r\n" +
          "\x1b[31m" +
          `[ChatDock] ${msg.error}` +
          "\x1b[0m\r\n"
        );

        status(
          "hata"
        );
      }
    }
  );


  shadow
    .getElementById(
      "newtab"
    )
    .addEventListener(
      "click",
      () =>
        addOwned(
          shadow
            .getElementById(
              "host"
            )
            .value
          ||
          "zaku"
        )
    );


  shadow
    .getElementById(
      "sessions"
    )
    .addEventListener(
      "click",
      showSessions
    );


  shadow
    .getElementById(
      "autosend"
    )
    .addEventListener(
      "click",
      () => {

        STATE.autoSend =
          !STATE.autoSend;
        localStorage.setItem(
          "zaku-chatdock:autoSend",
          STATE.autoSend ? "1" : "0"
        );


        shadow
          .getElementById(
            "autosend"
          )
          .textContent =
          STATE.autoSend
            ? "AUTO→CHAT ON"
            : "AUTO→CHAT OFF";
      }
    );


  shadow
    .getElementById(
      "hide"
    )
    .addEventListener(
      "click",
      () => {

        STATE.collapsed =
          !STATE.collapsed;

        syncRail();
        saveMeta();
      }
    );


  shadow
    .getElementById(
      "send50"
    )
    .addEventListener(
      "click",
      () =>
        insertComposer(
          "```text\n" +
          lastLines(50) +
          "\n```"
        )
    );


  shadow
    .getElementById(
      "send200"
    )
    .addEventListener(
      "click",
      () =>
        insertComposer(
          "```text\n" +
          lastLines(200) +
          "\n```"
        )
    );


  document.addEventListener(
    "keydown",
    e => {

      if (
        e.ctrlKey
        &&
        e.shiftKey
        &&
        e.code ===
        "Backquote"
      ) {

        e.preventDefault();


        STATE.panelOpen =
          !STATE.panelOpen;


        dock
          .classList
          .toggle(
            "hidden",
            !STATE.panelOpen
          );


        if (
          STATE.panelOpen
        ) {

          syncRail();

          const t =
            active();


          if (
            t &&
            !STATE.collapsed
          ) {

            requestAnimationFrame(
              () => {

                fit(t);

                t.term.focus();
              }
            );
          }
        }
      }
    },
    true
  );


  (() => {

    const g =
      shadow.getElementById(
        "grab"
      );

    let moving =
      false;


    g.addEventListener(
      "mousedown",
      e => {

        moving =
          true;

        e.preventDefault();
      }
    );


    addEventListener(
      "mousemove",
      e => {

        if (!moving)
          return;


        STATE.width =
          Math.min(
            Math.max(
              320,
              innerWidth -
              e.clientX
            ),
            Math.floor(
              innerWidth *
              .72
            )
          );


        dock.style.width =
          `${STATE.width}px`;


        const t =
          active();


        if (t)
          fit(t);
      }
    );


    addEventListener(
      "mouseup",
      () => {

        if (moving) {

          moving =
            false;

          saveMeta();
        }
      }
    );
  })();


  addEventListener(
    "resize",
    () => {

      const t =
        active();

      if (t) {

        requestAnimationFrame(
          () =>
            fit(t)
        );
      }
    }
  );


  new MutationObserver(
    installCodeButtons
  )
    .observe(
      document.documentElement,
      {
        subtree: true,
        childList: true
      }
    );


  async function init() {
    const autoSendButton =
      shadow.getElementById("autosend");

    if (autoSendButton) {
      autoSendButton.textContent =
        STATE.autoSend
          ? "AUTO→CHAT ON"
          : "AUTO→CHAT OFF";
    }


    const info =
      conversationInfo();


    Object.assign(
      STATE,
      info
    );


    shadow
      .getElementById(
        "chatname"
      )
      .textContent =
      STATE.title;


    const meta =
      await loadMeta();


    if (
      meta?.width
    ) {

      STATE.width =
        Math.min(
          Math.max(
            320,
            meta.width
          ),
          Math.floor(
            innerWidth *
            .72
          )
        );


      dock.style.width =
        `${STATE.width}px`;
    }

    if (
      typeof meta?.collapsed ===
      "boolean"
    ) {

      STATE.collapsed =
        meta.collapsed;
    }

    syncRail();


    if (
      meta?.tabs?.length
    ) {

      for (
        const old
        of meta.tabs
      ) {

        const t = {
          ...old
        };


        if (
          !t.attached
        ) {

          t.label =
            tabLabel(
              t.host,
              t.n || 1
            );


          if (!t.tmux) {

            t.tmux =
              tmuxName(
                t.host,
                t.n || 1
              );
          }
        }


        STATE.tabs.push(
          t
        );


        makeTerminal(
          t
        );
      }


      activate(
        (
          meta.activeId
          &&
          STATE.terminals.has(
            meta.activeId
          )
        )
          ? meta.activeId
          : STATE.tabs[0].id
      );
    }

    else {

      addOwned(
        "zaku"
      );
    }


    installCodeButtons();
    syncRail();
  }


  setInterval(
    () => {

      if (
        location.href !==
        STATE.currentUrl
      ) {

        STATE.currentUrl =
          location.href;


        const next =
          conversationInfo();


        if (
          next.chatKey !==
          STATE.chatKey
        ) {

          for (
            const t
            of STATE.tabs
          ) {

            send({
              type: "close",
              session: t.id
            });
          }


          location.reload();
        }
      }
    },
    800
  );


  init();

  // v0.11 host health refresh.
  setInterval(
    requestHealth,
    15000
  );


})();
