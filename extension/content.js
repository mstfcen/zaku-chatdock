"use strict";

(() => {

  const EXT =
    globalThis.browser
    ??
    globalThis.chrome;

  if (!EXT)
    return;


  if (
    globalThis
      .__ZAKU_CHATDOCK_V05__
  )
    return;

  globalThis
    .__ZAKU_CHATDOCK_V05__ =
    true;


  const port =
    EXT.runtime.connect({
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

    collapsed: true,

    autoSend: true,

    autoMission: true,

    missionInjecting: false,

    mission: {
      enabled: false,
      goal: "",
      extra: "",
      seeded: false
    },

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
          ? "L"
          : "R"
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

      mission: {
        enabled:
          !!STATE.mission.enabled,
        goal:
          STATE.mission.goal || "",
        extra:
          STATE.mission.extra || "",
        seeded:
          !!STATE.mission.seeded
      },

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

    #missionpanel{
      position:absolute;
      top:52px;
      right:10px;
      width:min(430px,calc(100% - 20px));
      max-height:calc(100vh - 72px);
      overflow:auto;
      display:none;
      z-index:90;
      padding:14px;
      background:#151515;
      border:1px solid #414141;
      border-radius:12px;
      box-shadow:0 18px 60px rgba(0,0,0,.55)
    }

    #missionpanel.open{
      display:block
    }

    #missionpanel .mh{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      margin-bottom:12px
    }

    #missionpanel .mtitle{
      font-size:13px;
      font-weight:800
    }

    #missionpanel .msub{
      font-size:10px;
      color:#888;
      margin-top:3px
    }

    #missionpanel label{
      display:block;
      margin:10px 0 5px;
      color:#aaa;
      font-size:10px;
      font-weight:700;
      text-transform:uppercase;
      letter-spacing:.05em
    }

    #missionpanel textarea{
      display:block;
      width:100%;
      resize:vertical;
      min-height:80px;
      padding:9px 10px;
      background:#0d0d0d;
      color:#eee;
      border:1px solid #343434;
      border-radius:8px;
      outline:none;
      font:12px/1.4 ui-sans-serif,system-ui,sans-serif
    }

    #missionpanel textarea:focus{
      border-color:#666
    }

    #missionextra{
      min-height:62px!important
    }

    #missionpanel .mactions{
      display:flex;
      flex-wrap:wrap;
      gap:7px;
      margin-top:12px
    }

    #missionpanel .mnote{
      margin-top:10px;
      color:#777;
      font-size:10px;
      line-height:1.35
    }

    #mission.active{
      border-color:#4f7d5a;
      background:#19311f
    }

    #automission.on{
      border-color:#4f7d5a;
      background:#19311f
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
    #dock.collapsed #picker,
    #dock.collapsed #missionpanel{
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

    #dock.collapsed #mission::before{
      content:"🎯";
      font-size:17px
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


  style.textContent += `

    /*
     * v0.8 Opera-style drawer
     * The rail is always tiny.
     * The terminal is an overlay drawer.
     */

    #dock{
      right:58px !important;
      top:8px !important;
      height:calc(100vh - 16px) !important;

      border:
        1px solid
        rgba(255,255,255,.10) !important;

      border-radius:
        14px 0 0 14px !important;

      box-shadow:
        -18px 0 55px
        rgba(0,0,0,.38) !important;

      transform:
        translateX(0);

      opacity:1;

      transition:
        transform .20s ease,
        opacity .16s ease,
        width .14s ease !important;

      overflow:hidden;
    }


    #dock.drawer-hidden{
      transform:
        translateX(
          calc(100% + 74px)
        );

      opacity:0;

      pointer-events:none;
    }


    #dock.drawer-hidden #grab{
      pointer-events:none;
    }


    /*
     * Old collapsed layout is no longer used.
     * Keep the class harmless for old saved state.
     */

    #dock.collapsed{
      width:520px !important;
      min-width:320px !important;
    }


    #dock.collapsed #grab,
    #dock.collapsed #brand,
    #dock.collapsed #host,
    #dock.collapsed #status,
    #dock.collapsed #tabs,
    #dock.collapsed #termwrap,
    #dock.collapsed #footer,
    #dock.collapsed #picker,
    #dock.collapsed #missionpanel{
      display:revert !important;
    }


    #dock.collapsed #top{
      display:flex !important;
      flex-direction:row !important;
      align-items:center !important;
      min-height:44px !important;
      padding:6px 8px !important;
    }


    #dock.collapsed #top button{
      width:auto !important;
      min-height:0 !important;
      padding:6px 8px !important;
      font-size:12px !important;
      display:inline-flex !important;
    }


    #dock.collapsed #newtab::before,
    #dock.collapsed #sessions::before,
    #dock.collapsed #mission::before,
    #dock.collapsed #autosend::before,
    #dock.collapsed #hide::before{
      content:none !important;
    }


    #top{
      background:
        rgba(18,18,18,.96) !important;

      backdrop-filter:
        blur(16px);

      gap:5px !important;
    }


    #brand{
      color:#b7b7b7;
      font-size:11px !important;
      letter-spacing:.03em;
    }


    #status{
      color:#777 !important;
      font-size:10px !important;
    }


    #tabs{
      scrollbar-width:thin;
    }


    /*
     * Fixed Opera-style rail
     */

    #chatdock-rail{
      position:fixed;

      top:0;
      right:0;

      width:54px;
      height:100vh;

      z-index:2147483647;

      display:flex;
      flex-direction:column;
      align-items:center;

      gap:8px;

      padding:
        10px 6px;

      background:
        rgba(13,13,13,.96);

      border-left:
        1px solid
        rgba(255,255,255,.08);

      box-shadow:
        -4px 0 18px
        rgba(0,0,0,.18);

      font-family:
        ui-sans-serif,
        system-ui,
        sans-serif;
    }


    #chatdock-rail button{
      width:42px;
      height:42px;

      display:flex;
      align-items:center;
      justify-content:center;

      padding:0;

      border:
        1px solid
        transparent;

      border-radius:11px;

      background:
        transparent;

      color:#aaa;

      font:
        600 15px
        ui-sans-serif,
        system-ui,
        sans-serif;

      cursor:pointer;

      transition:
        background .13s ease,
        border-color .13s ease,
        color .13s ease,
        transform .13s ease;
    }


    #chatdock-rail button:hover{
      color:#fff;

      background:
        rgba(255,255,255,.08);

      border-color:
        rgba(255,255,255,.08);
    }


    #chatdock-rail button:active{
      transform:
        scale(.94);
    }


    #chatdock-rail button.active{
      color:#fff;

      background:
        rgba(255,255,255,.10);

      border-color:
        rgba(255,255,255,.12);
    }


    #chatdock-rail #rail-terminal{
      font-family:
        "DejaVu Sans Mono",
        "Liberation Mono",
        monospace;

      font-size:13px;
      font-weight:800;
    }


    #chatdock-rail #rail-mission.active{
      background:#19311f;
      border-color:#4f7d5a;
    }


    #rail-spacer{
      flex:1;
    }


    #rail-state{
      width:8px;
      height:8px;

      border-radius:50%;

      background:#555;

      margin:
        4px 0
        3px;
    }


    #rail-state.connected{
      background:#70a77b;

      box-shadow:
        0 0 9px
        rgba(112,167,123,.5);
    }


    @media (max-width:720px){

      #dock{
        right:54px !important;
        top:0 !important;

        height:100vh !important;

        border-radius:0 !important;
      }

    }

  `;



  fetch(
    EXT.runtime.getURL(
      "vendor/xterm.css"
    )
  )
    .then(
      r => r.text()
    )
    .then(
      css => {

        const s =
          document.createElement(
            "style"
          );

        s.textContent =
          css;

        shadow.appendChild(
          s
        );
      }
    )
    .catch(
      () => {}
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
          Local
        </option>
        <option value="canavar">
          Remote
        </option>
      </select>

      <button id="newtab">
        ＋ Terminal
      </button>

      <button id="sessions">
        ☰ Sessions
      </button>

      <button id="mission">
        🎯 Mission
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

    <div id="missionpanel">

      <div class="mh">
        <div>
          <div class="mtitle">
            🎯 Mission Mode
          </div>
          <div class="msub">
            ChatGPT + ChatDock execution contract
          </div>
        </div>

        <button id="missionclose">
          ×
        </button>
      </div>

      <label for="missiongoal">
        Objective
      </label>

      <textarea
        id="missiongoal"
        placeholder="Example: Diagnose and permanently fix the Bluetooth problem on this machine."
      ></textarea>

      <label for="missionextra">
        Extra instructions
      </label>

      <textarea
        id="missionextra"
        placeholder="Optional constraints, preferences, forbidden actions..."
      ></textarea>

      <div class="mactions">

        <button id="missionstart">
          ▶ Start / Update
        </button>

        <button id="missionend">
          ■ End
        </button>

        <button id="automission">
          New chat auto
        </button>

      </div>

      <div class="mnote">
        Auto mode wraps the first message of a brand-new chat
        as the mission objective. It is sent as a normal,
        visible user message — not as a hidden system prompt.
      </div>

    </div>

    <div id="toast"></div>
  `;

  shadow.appendChild(
    dock
  );

  const rail =
    document.createElement(
      "div"
    );

  rail.id =
    "chatdock-rail";

  rail.innerHTML = `
    <button
      id="rail-terminal"
      title="Terminal"
    >
      &gt;_
    </button>

    <button
      id="rail-mission"
      title="Mission Mode"
    >
      🎯
    </button>

    <button
      id="rail-new"
      title="Yeni terminal"
    >
      ＋
    </button>

    <button
      id="rail-sessions"
      title="tmux sessions"
    >
      ≡
    </button>

    <div id="rail-spacer"></div>

    <div
      id="rail-state"
      title="Native bridge"
    ></div>
  `;

  shadow.appendChild(
    rail
  );



  function refreshRail() {

    const terminalButton =
      shadow.getElementById(
        "rail-terminal"
      );

    const missionButton =
      shadow.getElementById(
        "rail-mission"
      );

    const stateDot =
      shadow.getElementById(
        "rail-state"
      );


    terminalButton
      ?.classList
      .toggle(
        "active",
        !STATE.collapsed
      );


    missionButton
      ?.classList
      .toggle(
        "active",
        !!STATE.mission?.enabled
      );


    stateDot
      ?.classList
      .toggle(
        "connected",
        !!STATE.bridge
      );
  }


  function syncRail() {

    /*
     * v0.8:
     * collapsed means drawer CLOSED.
     * The 54px rail remains visible.
     */

    dock.classList.remove(
      "collapsed"
    );

    dock.classList.toggle(
      "drawer-hidden",
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
          : "ChatDock'u kapat";

      b.textContent =
        "×";
    }


    refreshRail();


    if (!STATE.collapsed) {

      STATE.panelOpen =
        true;

      dock.classList.remove(
        "hidden"
      );


      const t =
        active();

      if (t) {

        requestAnimationFrame(
          () => {

            fit(t);

          }
        );
      }
    }
  }


  function setDrawerOpen(
    open
  ) {

    STATE.collapsed =
      !open;

    STATE.panelOpen =
      true;

    dock.classList.remove(
      "hidden"
    );

    syncRail();

    saveMeta();
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


  function hostDisplay(
    host
  ) {

    return (
      host === "zaku"
        ? "local"
        : "remote"
    );
  }


  function missionEnvelope(
    goal,
    extra = ""
  ) {

    const cleanGoal =
      String(goal || "")
        .trim();

    const cleanExtra =
      String(extra || "")
        .trim();

    return (
      `[CHATDOCK_MISSION v1]\n` +
      `Objective:\n` +
      `${cleanGoal}\n\n` +

      `Operating contract:\n` +

      `1. Own the objective and drive it to a verified completion.\n` +

      `2. ChatDock is available as the terminal execution loop. ` +
      `When terminal work is required, return exactly one ` +
      `self-contained executable code block for the active host.\n` +

      `3. Prefer inspect -> act -> verify -> continue. ` +
      `Do not stop after merely suggesting commands when execution ` +
      `through ChatDock can advance the objective.\n` +

      `4. Results tagged [CHATDOCK_RESULT] are verified execution ` +
      `results. Read the exit code, cwd and output, then decide the ` +
      `next action.\n` +

      `5. Never claim that a command succeeded unless a ChatDock ` +
      `result confirms it.\n` +

      `6. Do not ask the user to copy terminal output, paste commands, ` +
      `or manually relay routine execution results. ChatDock handles ` +
      `that loop.\n` +

      `7. Ask the user only when an irreducible human action is needed: ` +
      `physical interaction, credentials, a genuinely ambiguous choice, ` +
      `purchase/payment, external communication, or an irreversible / ` +
      `destructive operation requiring approval.\n` +

      `8. Keep explanations concise while work is in progress. ` +
      `When the objective is complete, state what was verified and any ` +
      `remaining caveat.\n` +

      (
        cleanExtra
          ? `\nMission-specific instructions:\n${cleanExtra}\n`
          : ""
      ) +

      `[/CHATDOCK_MISSION]`
    );
  }


  async function saveGlobalSettings() {

    await browser
      .storage
      .local
      .set({
        "chatdock:v08:settings": {
          autoMission:
            !!STATE.autoMission
        }
      });
  }


  function refreshMissionUi() {

    const missionButton =
      shadow.getElementById(
        "mission"
      );

    if (missionButton) {

      missionButton.classList.toggle(
        "active",
        !!STATE.mission.enabled
      );

      missionButton.textContent =
        STATE.mission.enabled
          ? "🎯 Active"
          : "🎯 Mission";

      missionButton.title =
        STATE.mission.enabled
          ? STATE.mission.goal
          : "Mission Mode";
    }


    refreshRail();


    const autoButton =
      shadow.getElementById(
        "automission"
      );

    if (autoButton) {

      autoButton.classList.toggle(
        "on",
        !!STATE.autoMission
      );

      autoButton.textContent =
        STATE.autoMission
          ? "New chat auto: ON"
          : "New chat auto: OFF";
    }
  }


  function openMissionPanel() {

    const panel =
      shadow.getElementById(
        "missionpanel"
      );

    const goal =
      shadow.getElementById(
        "missiongoal"
      );

    const extra =
      shadow.getElementById(
        "missionextra"
      );

    goal.value =
      STATE.mission.goal || "";

    extra.value =
      STATE.mission.extra || "";

    panel.classList.toggle(
      "open"
    );

    refreshMissionUi();

    if (
      panel.classList.contains(
        "open"
      )
    ) {

      setTimeout(
        () => goal.focus(),
        20
      );
    }
  }


  async function startMission(
    goal,
    extra = "",
    auto = false
  ) {

    goal =
      String(goal || "")
        .trim();

    extra =
      String(extra || "")
        .trim();

    if (!goal) {

      toast(
        "Mission objective boş"
      );

      return false;
    }


    if (
      !auto
      &&
      composerText(
        composer()
      ).trim()
    ) {

      toast(
        "Mesaj kutusu dolu; Mission prompt gönderilmedi"
      );

      return false;
    }


    STATE.mission = {
      enabled: true,
      goal,
      extra,
      seeded: false
    };


    if (!STATE.convoId) {

      await browser
        .storage
        .local
        .set({
          "chatdock:v08:pendingMission": {
            goal,
            extra,
            enabled: true,
            seeded: true,
            ts: Date.now()
          }
        });
    }


    await saveMeta();

    refreshMissionUi();


    STATE.missionInjecting =
      true;


    const inserted =
      insertComposer(
        missionEnvelope(
          goal,
          extra
        )
      );


    if (!inserted) {

      STATE.missionInjecting =
        false;

      return false;
    }


    await sleep(
      80
    );


    const ok =
      await submitComposer();


    STATE.mission.seeded =
      !!ok;


    STATE.missionInjecting =
      false;


    await saveMeta();

    refreshMissionUi();


    shadow
      .getElementById(
        "missionpanel"
      )
      ?.classList
      .remove(
        "open"
      );


    toast(
      ok
        ? "Mission başladı"
        : "Mission prompt hazır; Send bulunamadı"
    );


    return ok;
  }


  async function endMission() {

    STATE.mission.enabled =
      false;

    STATE.mission.seeded =
      false;

    await saveMeta();

    refreshMissionUi();


    const current =
      composerText(
        composer()
      ).trim();


    if (!current) {

      STATE.missionInjecting =
        true;

      insertComposer(
        "[CHATDOCK_MISSION_END]\n" +
        "The active ChatDock mission is ended. " +
        "Return to normal conversation mode.\n" +
        "[/CHATDOCK_MISSION_END]"
      );

      await sleep(
        60
      );

      await submitComposer();

      STATE.missionInjecting =
        false;
    }


    toast(
      "Mission ended"
    );
  }


  function autoMissionCandidate() {

    if (
      !STATE.autoMission
      ||
      STATE.missionInjecting
      ||
      STATE.convoId
      ||
      STATE.mission.seeded
    ) {

      return "";
    }


    return composerText(
      composer()
    ).trim();
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


      e.appendChild(
        labelSpan
      );

      e.appendChild(
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

        fontFamily:
          '"DejaVu Sans Mono",' +
          '"Liberation Mono",' +
          'monospace',

        fontSize: 13,

        lineHeight: 1.12,

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
      slot
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


    send({
      type: "open",
      session:
        meta.id,
      host:
        meta.host,
      tmux:
        meta.tmux,
      cols:
        term.cols,
      rows:
        term.rows
    });
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

        cwd:
          null,

        startedAt:
          Date.now(),

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

      r.cwd =
        msg.cwd
        ||
        r.cwd
        ||
        "?";

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


    const durationMs =
      Math.max(
        0,
        Date.now()
        -
        (
          r.startedAt
          ||
          Date.now()
        )
      );


    const payload =
      `[CHATDOCK_RESULT v1]\n` +
      `mission: ${
        STATE.mission.enabled
          ? "active"
          : "none"
      }\n` +
      `run_id: ${msg.run_id}\n` +
      `host: ${hostDisplay(r.host)}\n` +
      `terminal: ${t?.label || r.session}\n` +
      `tmux: ${t?.tmux || "unknown"}\n` +
      `cwd: ${r.cwd || "unknown"}\n` +
      `exit_code: ${code}\n` +
      `duration_ms: ${durationMs}\n` +
      `output_truncated: ${truncated ? "true" : "false"}\n` +
      `<output>\n` +
      `${out}\n` +
      `</output>\n` +
      `[/CHATDOCK_RESULT]` +
      (
        STATE.mission.enabled
          ? (
              `\n\nContinue the active mission from this verified ` +
              `execution result. If another terminal action is required, ` +
              `return exactly one next executable code block. Do not ask ` +
              `the user to copy/paste terminal output.`
            )
          : ""
      );


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
            ? "LOCAL"
            : "REMOTE"
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

      if (
        msg?.__chatdock_ctl ===
        "open"
      ) {

        STATE.bridge =
          true;

        status(
          "bridge bağlı"
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
        "output"
      ) {

        t.term.write(
          msg.data
        );

        status(
          `${t.host} bağlı`
        );
      }


      else if (
        msg.type ===
        "opened"
      ) {

        status(
          `${t.host} bağlı`
        );

        requestAnimationFrame(
          () =>
            fit(t)
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
      "rail-terminal"
    )
    .addEventListener(
      "click",
      () => {

        setDrawerOpen(
          STATE.collapsed
        );

      }
    );


  shadow
    .getElementById(
      "rail-mission"
    )
    .addEventListener(
      "click",
      () => {

        setDrawerOpen(
          true
        );

        setTimeout(
          openMissionPanel,
          30
        );

      }
    );


  shadow
    .getElementById(
      "rail-new"
    )
    .addEventListener(
      "click",
      () => {

        setDrawerOpen(
          true
        );

        addOwned(
          shadow
            .getElementById(
              "host"
            )
            .value
          ||
          "zaku"
        );

      }
    );


  shadow
    .getElementById(
      "rail-sessions"
    )
    .addEventListener(
      "click",
      () => {

        setDrawerOpen(
          true
        );

        showSessions();

      }
    );


  document.addEventListener(
    "keydown",
    e => {

      if (
        e.key ===
        "Escape"
      ) {

        const missionPanel =
          shadow.getElementById(
            "missionpanel"
          );

        const picker =
          shadow.getElementById(
            "picker"
          );


        if (
          missionPanel
            ?.classList
            .contains(
              "open"
            )
        ) {

          missionPanel
            .classList
            .remove(
              "open"
            );

          return;
        }


        if (
          picker
            ?.classList
            .contains(
              "open"
            )
        ) {

          picker
            .classList
            .remove(
              "open"
            );

          return;
        }


        if (!STATE.collapsed) {

          setDrawerOpen(
            false
          );

        }
      }

    },
    true
  );


  shadow
    .getElementById(
      "mission"
    )
    .addEventListener(
      "click",
      openMissionPanel
    );


  shadow
    .getElementById(
      "missionclose"
    )
    .addEventListener(
      "click",
      () =>
        shadow
          .getElementById(
            "missionpanel"
          )
          .classList
          .remove(
            "open"
          )
    );


  shadow
    .getElementById(
      "missionstart"
    )
    .addEventListener(
      "click",
      () =>
        startMission(
          shadow
            .getElementById(
              "missiongoal"
            )
            .value,

          shadow
            .getElementById(
              "missionextra"
            )
            .value,

          false
        )
    );


  shadow
    .getElementById(
      "missionend"
    )
    .addEventListener(
      "click",
      endMission
    );


  shadow
    .getElementById(
      "automission"
    )
    .addEventListener(
      "click",
      async () => {

        STATE.autoMission =
          !STATE.autoMission;

        await saveGlobalSettings();

        refreshMissionUi();
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

        setDrawerOpen(
          false
        );

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
        e.composedPath
        &&
        e.composedPath()
          .includes(root)
      )
        return;


      if (
        e.key === "Enter"
        &&
        !e.shiftKey
        &&
        !e.isComposing
      ) {

        const goal =
          autoMissionCandidate();


        if (goal) {

          e.preventDefault();
          e.stopImmediatePropagation();

          startMission(
            goal,
            "",
            true
          );

          return;
        }
      }
    },
    true
  );


  document.addEventListener(
    "click",
    e => {

      if (
        e.composedPath
        &&
        e.composedPath()
          .includes(root)
      )
        return;


      const target =
        e.target
          ?.closest
          ?.(
            'button[data-testid="send-button"],' +
            'button[aria-label="Send prompt"],' +
            'button[aria-label="Gönder"],' +
            'button[aria-label*="Send"],' +
            'button[aria-label*="Gönder"]'
          );


      if (!target)
        return;


      const goal =
        autoMissionCandidate();


      if (!goal)
        return;


      e.preventDefault();
      e.stopImmediatePropagation();


      startMission(
        goal,
        "",
        true
      );
    },
    true
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


        setDrawerOpen(
          STATE.collapsed
        );


        if (!STATE.collapsed) {

          const t =
            active();

          if (t) {

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


    const settingsResult =
      await browser
        .storage
        .local
        .get(
          "chatdock:v08:settings"
        );


    const settings =
      settingsResult[
        "chatdock:v08:settings"
      ]
      ||
      {};


    if (
      typeof settings.autoMission ===
      "boolean"
    ) {

      STATE.autoMission =
        settings.autoMission;
    }


    let meta =
      await loadMeta();


    if (meta?.mission) {

      STATE.mission = {
        enabled:
          !!meta.mission.enabled,
        goal:
          meta.mission.goal || "",
        extra:
          meta.mission.extra || "",
        seeded:
          !!meta.mission.seeded
      };
    }


    if (
      !meta?.mission
      &&
      STATE.convoId
    ) {

      const pendingResult =
        await browser
          .storage
          .local
          .get(
            "chatdock:v08:pendingMission"
          );


      const pending =
        pendingResult[
          "chatdock:v08:pendingMission"
        ];


      if (
        pending
        &&
        (
          Date.now()
          -
          Number(
            pending.ts || 0
          )
        )
        <
        120000
      ) {

        STATE.mission = {
          enabled: true,
          goal:
            pending.goal || "",
          extra:
            pending.extra || "",
          seeded: true
        };


        await browser
          .storage
          .local
          .remove(
            "chatdock:v08:pendingMission"
          );
      }
    }


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
    refreshMissionUi();


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

})();
