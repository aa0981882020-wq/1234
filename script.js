// ==========================================
// 毛孩星球 (Pet Planet) - 寵物分享交流平台前端核心邏輯
// 保留 localStorage 模擬資料庫機制，新增完整社交互動與人機圖形驗證
// ==========================================

// 預設寵物小爪頭貼 (SVG Base64)
const defaultAvatar =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="140" height="140">
    <rect width="140" height="140" rx="70" fill="#fff0b7"/>
    <text x="70" y="84" font-size="62" text-anchor="middle">🐾</text>
  </svg>`);

// 從 localStorage 初始化或讀取資料庫
let users = JSON.parse(localStorage.getItem("petUsersComplete")) || [];
let posts = JSON.parse(localStorage.getItem("petPostsComplete")) || [];
let currentUser = JSON.parse(localStorage.getItem("petCurrentUserComplete")) || null;

// 頁面 ID 陣列
const pages = ["sharePage", "authPage", "homePage", "postPage", "aboutPage"];

// ------------------------------------------
// 🏐 人機驗證圖形驗證碼 Pool (日向翔陽本機圖組)
// ------------------------------------------
const captchaPool = [
  { id: 1, name: "孝支", url: "圖片/孝支.jpg", isTarget: false },
  { id: 2, name: "山口", url: "圖片/山口.jpg", isTarget: false },
  { id: 3, name: "影山", url: "圖片/影山.jpg", isTarget: false },
  { id: 4, name: "日向", url: "圖片/日向.jpg", isTarget: true },
  { id: 5, name: "王牌", url: "圖片/王牌.jpg", isTarget: false },
  { id: 6, name: "研磨", url: "圖片/研磨.jpg", isTarget: false },
  { id: 7, name: "西谷", url: "圖片/西谷.jpg", isTarget: false },
  { id: 8, name: "音", url: "圖片/音.jpg", isTarget: false },
  { id: 9, name: "黑尾", url: "圖片/黑尾.jpg", isTarget: false }
];

// 圖形驗證當前狀態變數
let currentCaptchaTarget = "";       // 當前驗證目標 ("貓咪" 或 "狗狗")
let currentCaptchaImages = [];       // 九宮格當前隨機圖片陣列
let selectedCaptchaIndices = [];     // 使用者已點選的圖片索引
let pendingAuthAction = null;        // 掛起待處理的驗證請求 ({ type: 'login' | 'register', data })

// 貼文自訂確認刪除狀態變數
let pendingDeletePostId = "";
let pendingDeleteIsProfilePage = false;

// 個人首頁當前分頁籤狀態 ("myPosts" 或 "likedPosts")
let currentProfileTab = "myPosts";

// 當前正在查看的他人的用戶 ID
let activeViewUserId = "";

// ------------------------------------------
// 🚀 初始化載入與事件綁定
// ------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  seedDemoUsers();       // 填入示範用戶
  seedDemoPosts();       // 填入示範貼文
  bindEvents();          // 綁定檔案上傳與輸入計數器
  bindConfirmDeleteBtn(); // 綁定自訂刪除視窗的確認動作
  updateNavbar();        // 初始化頂部導覽列狀態
  showPage("sharePage"); // 預設顯示分享區
});

/**
 * 綁定原生上傳按鈕的 Change 事件，實現即時預覽與清除
 */
function bindEvents() {
  // 註冊頭貼上傳即時預覽
  const regAvatar = document.getElementById("regAvatar");
  if (regAvatar) {
    regAvatar.addEventListener("change", async e => {
      const file = e.target.files[0];
      if (!file) return;
      const src = await fileToBase64(file);
      document.getElementById("avatarPreview").innerHTML = `<img src="${src}" alt="頭貼預覽">`;
    });
  }

  // 貼文相片上傳即時預覽
  const postImage = document.getElementById("postImage");
  if (postImage) {
    postImage.addEventListener("change", async e => {
      const file = e.target.files[0];
      const preview = document.getElementById("postImagePreview");
      const clearBtn = document.getElementById("clearImageBtn");
      const placeholder = document.getElementById("uploadPlaceholderContent");

      if (!file) {
        clearPostImage();
        return;
      }

      const src = await fileToBase64(file);
      preview.src = src;
      preview.classList.remove("hidden");
      clearBtn.classList.remove("hidden");
      if (placeholder) placeholder.classList.add("hidden");
    });
  }

  // 貼文內容輸入框字數動態統計
  const postContent = document.getElementById("postContent");
  if (postContent) {
    postContent.addEventListener("input", e => {
      document.getElementById("contentCounter").textContent = `${e.target.value.length} / 500`;
    });
  }
}

/**
 * 清除已選擇的貼文圖片與預覽容器狀態
 */
function clearPostImage(event) {
  if (event) event.stopPropagation(); // 阻止點擊清除按鈕時，觸發父容器 image-upload-zone 的 click
  
  const postImage = document.getElementById("postImage");
  const preview = document.getElementById("postImagePreview");
  const clearBtn = document.getElementById("clearImageBtn");
  const placeholder = document.getElementById("uploadPlaceholderContent");
  
  if (postImage) postImage.value = "";
  if (preview) {
    preview.src = "";
    preview.classList.add("hidden");
  }
  if (clearBtn) clearBtn.classList.add("hidden");
  if (placeholder) placeholder.classList.remove("hidden");
}

/**
 * 密碼輸入框 明文 / 密文 可視性切換
 * @param {string} inputId 輸入框 DOM ID
 */
function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  if (input.type === "password") {
    input.type = "text";
  } else {
    input.type = "password";
  }
}

// ------------------------------------------
// 📦 資料庫種子初始化 (Seed Data)
// ------------------------------------------

/**
 * 初始化填入示範使用者，使查看他人首頁及粉絲追蹤功能在初次運行時極具完整度
 */
function seedDemoUsers() {
  if (users.length > 0) return;

  users = [
    {
      id: "catlover",
      name: "布丁貓奴",
      password: "123",
      avatar: defaultAvatar,
      bio: "家裡有一隻三歲大的橘貓叫「布丁」，每天最愛霸佔電腦鍵盤。鍵盤守護神參上！🐾🐱",
      followers: ["dogfan"]
    },
    {
      id: "dogfan",
      name: "柴柴控",
      password: "123",
      avatar: defaultAvatar,
      bio: "赤柴「豆柴」的一級鏟屎官 🐕。熱愛拍照、健行，歡迎大家交流狗狗食慾保養經驗！✨",
      followers: []
    }
  ];
  saveData();
}

/**
 * 初始化填入示範貼文
 */
function seedDemoPosts() {
  if (posts.length > 0) return;

  posts = [
    {
      postId: "demo-1",
      authorId: "catlover",
      authorName: "布丁貓奴",
      authorAvatar: defaultAvatar,
      category: "日常分享",
      title: "我家布丁今天又在霸佔我的鍵盤...",
      content: "原本下定決心要好好寫期末作業，結果布丁直接一屁股趴在鍵盤上發出呼嚕聲，甚至開始翻肚子睡著。看來，今天天意是要我陪牠玩，作業明天再說吧！😂",
      image: "",
      likes: ["dogfan"],
      comments: [
        { id: "dogfan", name: "柴柴控", text: "這真的無解！貓咪好像自帶『鍵盤吸引磁場』一樣 😂", createdAt: new Date().toLocaleString("zh-TW") }
      ],
      createdAt: new Date(Date.now() - 3600000 * 2).toLocaleString("zh-TW") // 兩小時前
    },
    {
      postId: "demo-2",
      authorId: "dogfan",
      authorName: "柴柴控",
      authorAvatar: defaultAvatar,
      category: "照顧問題",
      title: "狗狗最近食慾不振，想尋求好物推薦！",
      content: "我家柴柴這幾天突然對原本的乾飼料興致缺缺，但精神和活動力都還十分正常，想問問各位有經驗的爸媽們，有沒有推薦的寵物肉泥、凍乾，或是拌飯好幫手來開胃呢？萬分感謝！🙏",
      image: "",
      likes: [],
      comments: [],
      createdAt: new Date(Date.now() - 3600000 * 12).toLocaleString("zh-TW") // 十二小時前
    }
  ];
  saveData();
}

/**
 * 將使用者與貼文的當前狀態寫入 localStorage 模擬資料庫持久化
 */
function saveData() {
  localStorage.setItem("petUsersComplete", JSON.stringify(users));
  localStorage.setItem("petPostsComplete", JSON.stringify(posts));
  localStorage.setItem("petCurrentUserComplete", JSON.stringify(currentUser));
}

/**
 * 異步將 File 上傳檔案轉為 Base64 字串，以便保存於 LocalStorage
 */
function fileToBase64(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// ------------------------------------------
// 🗺️ 頁面路由切換邏輯 (Page Router)
// ------------------------------------------

/**
 * 切換顯示的主頁面區塊，並更新對應的桌機與手機導覽列高亮
 * @param {string} pageId 目標顯示頁面的 ID
 */
function showPage(pageId) {
  // 隱藏全部原生分頁
  pages.forEach(id => {
    const pageEl = document.getElementById(id);
    if (pageEl) pageEl.classList.add("hidden");
  });
  
  // 隱藏查看他人首頁
  const userPageEl = document.getElementById("userPage");
  if (userPageEl) userPageEl.classList.add("hidden");

  // 顯示選定頁面
  const targetPage = document.getElementById(pageId);
  if (targetPage) targetPage.classList.remove("hidden");

  // 更新導覽列焦點高亮
  updateNavActiveState(pageId);

  // 依頁面性質執行特定的初次渲染
  if (pageId === "sharePage") renderAllPosts();
  if (pageId === "homePage") renderHome();
  if (pageId === "userPage") renderUserProfile();
  
  // 平滑滾動至頁首
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * 更新導覽選單（含桌機頂部與手機底部導覽列）的焦點 Active 樣式
 */
function updateNavActiveState(pageId) {
  // 1. 桌機版導覽列更新
  const desktopBtns = document.querySelectorAll(".nav-btn");
  desktopBtns.forEach(btn => btn.classList.remove("active"));
  
  const activeDesktopBtn = document.getElementById(`nav-${pageId}`);
  if (activeDesktopBtn) {
    activeDesktopBtn.classList.add("active");
  } else if (pageId === "homePage") {
    const profileNavBtn = document.getElementById("profileNavBtn");
    if (profileNavBtn) profileNavBtn.classList.add("active");
  }

  // 2. 手機版底部導覽列更新
  const mobBtns = document.querySelectorAll(".mobile-nav-btn");
  mobBtns.forEach(btn => btn.classList.remove("active"));
  
  const activeMobBtn = document.getElementById(`mob-${pageId}`);
  if (activeMobBtn) {
    activeMobBtn.classList.add("active");
  }
}

// ------------------------------------------
// 🐾 人機驗證 (Image Captcha) 邏輯
// ------------------------------------------

/**
 * 攔截登入表單的送出
 */
function login() {
  const id = document.getElementById("loginId").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!id || !password) {
    toast("請填寫使用者 ID 與密碼", "⚠️");
    return;
  }

  // 預先基本校驗，若帳號密碼根本不對，就不浪費用戶驗證 Captcha 的時間
  const user = users.find(u => u.id === id && u.password === password);
  if (!user) {
    toast("使用者 ID 或密碼錯誤，請重新輸入", "⚠️");
    return;
  }

  // 驗證無誤，掛起此登入請求，準備彈出人機驗證 Modal
  pendingAuthAction = {
    type: "login",
    data: { id, password }
  };

  openCaptchaModal();
}

/**
 * 攔截註冊表單的送出
 */
async function register() {
  const id = document.getElementById("regId").value.trim();
  const name = document.getElementById("regName").value.trim();
  const password = document.getElementById("regPassword").value.trim();
  const avatarFile = document.getElementById("regAvatar").files[0];

  if (!id || !name || !password) {
    toast("請完整填寫 ID、顯示暱稱與密碼", "⚠️");
    return;
  }

  if (id.length < 3) {
    toast("使用者 ID 長度至少需要 3 個字元", "⚠️");
    return;
  }

  if (users.some(user => user.id === id)) {
    toast("這個 ID 已經被別人註冊走囉", "⚠️");
    return;
  }

  // 先將圖片轉成 base64 存於暫存區中
  const avatar = avatarFile ? await fileToBase64(avatarFile) : defaultAvatar;

  // 掛起註冊請求，彈出人機驗證 Modal
  pendingAuthAction = {
    type: "register",
    data: { id, name, password, avatar }
  };

  openCaptchaModal();
}

/**
 * 開啟人機圖形驗證彈窗
 */
function openCaptchaModal() {
  document.getElementById("captchaModal").classList.remove("hidden");
  generateCaptcha();
}

/**
 * 關閉人機圖形驗證彈窗並清除掛起的動作
 */
function closeCaptchaModal() {
  document.getElementById("captchaModal").classList.add("hidden");
  pendingAuthAction = null;
}

/**
 * 隨機產生 Captcha 圖形驗證考題與 3x3 網格內容 (固定為選取日向翔陽本機圖片)
 */
function generateCaptcha() {
  // 題目固定為：請選取所有包含「日向翔陽 🏐」的圖片
  const promptText = document.querySelector(".captcha-prompt-text");
  if (promptText) {
    promptText.innerHTML = `請選取所有包含<strong>「日向翔陽 🏐」</strong>的圖片`;
  }

  // 複製 9 張本機圖片做隨機打亂
  currentCaptchaImages = [...captchaPool];
  shuffleArray(currentCaptchaImages);

  // 重置使用者的選擇索引與紅字錯誤提示
  selectedCaptchaIndices = [];
  const errorEl = document.getElementById("captchaError");
  if (errorEl) errorEl.classList.add("hidden");

  // 渲染九宮格 DOM
  const grid = document.getElementById("captchaGrid");
  if (grid) {
    grid.innerHTML = currentCaptchaImages.map((img, index) => `
      <div class="captcha-item" id="captcha-item-${index}" onclick="toggleCaptchaItem(${index})">
        <img src="${img.url}" alt="${img.name}" onerror="this.onerror=null; this.src='${defaultAvatar}';">
        <div class="captcha-checkbox">✓</div>
      </div>
    `).join("");
  }
}

/**
 * 點選/取消點選九宮格圖片
 */
function toggleCaptchaItem(index) {
  const item = document.getElementById(`captcha-item-${index}`);
  if (!item) return;

  if (selectedCaptchaIndices.includes(index)) {
    // 已經被點選，進行移除
    selectedCaptchaIndices = selectedCaptchaIndices.filter(i => i !== index);
    item.classList.remove("selected");
  } else {
    // 未被點選，加入選擇
    selectedCaptchaIndices.push(index);
    item.classList.add("selected");
  }
}

/**
 * 圖片驗證核對與驗證 (檢查是否選中且只選中日向翔陽)
 */
function verifyCaptcha() {
  let isAllCorrect = true;

  // 取得九宮格中真正屬於「日向翔陽」的正確圖片索引 (isTarget 為 true)
  const actualCorrectIndices = [];
  currentCaptchaImages.forEach((img, index) => {
    if (img.isTarget) {
      actualCorrectIndices.push(index);
    }
  });

  // 檢查選取數量是否與正確答案數量完全一致
  if (selectedCaptchaIndices.length !== actualCorrectIndices.length) {
    isAllCorrect = false;
  } else {
    // 檢查使用者選取的每一張圖片是否都是「日向翔陽」
    for (let index of selectedCaptchaIndices) {
      if (!currentCaptchaImages[index].isTarget) {
        isAllCorrect = false;
        break;
      }
    }
  }

  if (isAllCorrect) {
    // 驗證成功！先執行掛起的註冊或登入動作，隨後關閉驗證彈窗
    toast("✨ 圖片驗證成功！正在處理...", "🏐");
    completePendingAuth();
    closeCaptchaModal();
  } else {
    // 驗證失敗，顯示錯誤提示，並在 1 秒後自動洗牌換新題目與圖組
    const errorEl = document.getElementById("captchaError");
    if (errorEl) errorEl.classList.remove("hidden");
    toast("❌ 驗證錯誤，那不是日向翔陽喔！", "🙀");
    
    // 短暫延遲後刷新洗牌
    setTimeout(() => {
      generateCaptcha();
    }, 1000);
  }
}

/**
 * 打亂陣列的實用輔助函數 (Fisher-Yates Shuffle)
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * 驗證成功後，真正提交執行登入或註冊流程
 */
function completePendingAuth() {
  if (!pendingAuthAction) return;

  if (pendingAuthAction.type === "login") {
    const { id, password } = pendingAuthAction.data;
    
    // 再次從 users 尋找並存入當前登入狀態
    const user = users.find(u => u.id === id && u.password === password);
    currentUser = user;
    saveData();
    updateNavbar();

    // 清空輸入欄位值
    document.getElementById("loginId").value = "";
    document.getElementById("loginPassword").value = "";

    toast(`歡迎回到星球，${currentUser.name}！🐾`, "🎉");
    showPage("homePage");
    
  } else if (pendingAuthAction.type === "register") {
    const { id, name, password, avatar } = pendingAuthAction.data;

    // 將新註冊使用者 push 入模擬資料庫，並提供預設的空簡介(bio)與關注者(followers)陣列
    users.push({ 
      id, 
      name, 
      password, 
      avatar, 
      bio: "我們是新加入毛孩星球的快樂居民 🐾！", 
      followers: [] 
    });
    saveData();

    // 清空註冊欄位值
    document.getElementById("regId").value = "";
    document.getElementById("regName").value = "";
    document.getElementById("regPassword").value = "";
    document.getElementById("regAvatar").value = "";
    document.getElementById("avatarPreview").innerHTML = "🐾";

    toast("註冊成功，請重新登入", "🎉");
    switchAuth("login");
  }

  // 重置掛起狀態
  pendingAuthAction = null;
}

// ------------------------------------------
// 🔑 登入 / 註冊頁籤與登出控制
// ------------------------------------------

/**
 * 切換登入與註冊頁籤
 */
function switchAuth(type) {
  const isLogin = type === "login";
  document.getElementById("loginForm").classList.toggle("hidden", !isLogin);
  document.getElementById("registerForm").classList.toggle("hidden", isLogin);
  document.getElementById("loginTab").classList.toggle("active", isLogin);
  document.getElementById("registerTab").classList.toggle("active", !isLogin);
}

/**
 * 帳號登出，清除全域 currentUser 並切換頁面
 */
function logout() {
  currentUser = null;
  saveData();
  updateNavbar();
  toast("您已登出毛孩星球", "🚪");
  showPage("sharePage");
}

/**
 * 更新 Navbar 控制按鈕的顯示狀態
 */
function updateNavbar() {
  const hasUser = !!currentUser;
  
  // 桌機端導覽按鈕控制
  document.getElementById("authNavBtn").classList.toggle("hidden", hasUser);
  document.getElementById("logoutNavBtn").classList.toggle("hidden", !hasUser);
  
  // 更新 Hero 首頁卡片「加入星球」按鈕的顯示與否
  const heroAuthBtn = document.getElementById("heroAuthBtn");
  if (heroAuthBtn) {
    heroAuthBtn.classList.toggle("hidden", hasUser);
  }
}

// ------------------------------------------
// 👤 個人首頁 (Bio、分頁切換、成就徽章)
// ------------------------------------------

/**
 * 打開我自己的個人檔案，未登入則彈窗引導登入
 */
function openHome() {
  if (!currentUser) {
    askLogin();
    return;
  }
  
  // 重置我自己的分頁為「我的貼文」
  currentProfileTab = "myPosts";
  showPage("homePage");
}

/**
 * 切換個人首頁的分頁籤：我的貼文 v.s. 我按讚的貼文
 */
function switchProfileTab(tabName) {
  currentProfileTab = tabName;
  
  document.getElementById("tabMyPosts").classList.toggle("active", tabName === "myPosts");
  document.getElementById("tabLikedPosts").classList.toggle("active", tabName === "likedPosts");
  
  renderHome();
}

/**
 * 渲染我自己的個人首頁
 */
function renderHome() {
  if (!currentUser) {
    askLogin();
    return;
  }

  // 篩選與該使用者相關的貼文與讚數數據
  const myPostsList = posts.filter(post => post.authorId === currentUser.id);
  const myLikeCount = myPostsList.reduce((sum, post) => sum + (post.likes ? post.likes.length : 0), 0);
  const myCommentCount = myPostsList.reduce((sum, post) => sum + (post.comments ? post.comments.length : 0), 0);

  // 依選擇的頁籤分頁，篩選出真正要渲染的貼文清單
  let displayPosts = [];
  if (currentProfileTab === "myPosts") {
    displayPosts = myPostsList;
  } else {
    // 篩選出我點過讚的貼文
    displayPosts = posts.filter(post => post.likes && post.likes.includes(currentUser.id));
  }

  // 寫入基本個資 DOM
  document.getElementById("profileAvatar").src = currentUser.avatar || defaultAvatar;
  document.getElementById("profileName").textContent = currentUser.name;
  document.getElementById("profileId").textContent = `@${currentUser.id}`;
  
  // 顯示個人簡介 (Bio)
  const bioElement = document.getElementById("profileBio");
  if (currentUser.bio) {
    bioElement.textContent = currentUser.bio;
    bioElement.classList.remove("empty-bio");
  } else {
    bioElement.textContent = "點擊此處編輯個人簡介，介紹一下你和毛孩吧... 🐾";
    bioElement.classList.add("empty-bio");
  }
  
  // 數據計數器
  document.getElementById("myPostCount").textContent = myPostsList.length;
  document.getElementById("myLikeCount").textContent = myLikeCount;
  document.getElementById("myCommentCount").textContent = myCommentCount;

  // 渲染個人成就徽章
  document.getElementById("profileBadges").innerHTML = getUserBadges(currentUser.id);

  // 渲染貼文格柵
  document.getElementById("myPosts").innerHTML = displayPosts.length
    ? displayPosts.map(post => postCard(post, true)).join("")
    : (currentProfileTab === "myPosts" 
        ? `<div class="empty">您目前還沒有發表過貼文喔，點擊「新增貼文」寫些什麼吧！🐾</div>`
        : `<div class="empty">您目前還沒有對任何貼文點過讚喔 ❤️</div>`);
}

// ------------------------------------------
// 📝 個人簡介 (Bio) 在地直接編輯與儲存
// ------------------------------------------

/**
 * 開始編輯個人簡介，原地展開 textarea
 */
function startEditBio() {
  if (!currentUser) return;
  
  document.getElementById("profileBio").classList.add("hidden");
  document.getElementById("bioEditGroup").classList.remove("hidden");
  
  const bioInput = document.getElementById("bioInput");
  bioInput.value = currentUser.bio || "";
  bioInput.focus();
}

/**
 * 取消編輯個人簡介，回復原本顯示狀態
 */
function cancelEditBio() {
  document.getElementById("profileBio").classList.remove("hidden");
  document.getElementById("bioEditGroup").classList.add("hidden");
}

/**
 * 保存個人簡介 Bio 並持久儲存至 localStorage
 */
function saveBio() {
  const bioInput = document.getElementById("bioInput");
  const newBio = bioInput.value.trim();

  // 更新當前在線與資料庫中的使用者簡介
  currentUser.bio = newBio;
  
  const userIdx = users.findIndex(u => u.id === currentUser.id);
  if (userIdx > -1) {
    users[userIdx].bio = newBio;
  }

  saveData();
  renderHome(); // 重新渲染刷新個人首頁
  
  // 關閉輸入區
  cancelEditBio();
  toast("✨ 個人簡介已成功保存！", "📝");
}

// ------------------------------------------
// 👥 查看他人個人首頁 (UserProfile Page) & 關注 (Follow) 互動
// ------------------------------------------

/**
 * 查看他人的專屬個人檔案（點擊頭像或名字時觸發）
 * @param {string} userId 被查看目標的用戶 ID
 */
function viewUserProfile(userId) {
  // 如果點擊的就是當前登入者自己，直接前往個人首頁
  if (currentUser && currentUser.id === userId) {
    openHome();
    return;
  }

  activeViewUserId = userId;
  showPage("userPage");
}

/**
 * 渲染他人的個人首頁
 */
function renderUserProfile() {
  // 從模擬資料庫中尋找目標使用者
  const targetUser = users.find(u => u.id === activeViewUserId);
  if (!targetUser) {
    toast("⚠️ 找不到該使用者檔案", "😿");
    showPage("sharePage");
    return;
  }

  // 計算目標使用者的貼文與總體讚數
  const userPosts = posts.filter(post => post.authorId === activeViewUserId);
  const totalLikes = userPosts.reduce((sum, post) => sum + (post.likes ? post.likes.length : 0), 0);
  const followerCount = targetUser.followers ? targetUser.followers.length : 0;

  // 渲染個資與 Bio
  document.getElementById("userAvatar").src = targetUser.avatar || defaultAvatar;
  document.getElementById("userName").textContent = targetUser.name;
  document.getElementById("userId").textContent = `@${targetUser.id}`;
  document.getElementById("userBio").textContent = targetUser.bio || "這個人很低調，還沒有寫下任何簡介 🐾";
  
  // 填入統計數據
  document.getElementById("userPostCount").textContent = userPosts.length;
  document.getElementById("userLikeCount").textContent = totalLikes;
  document.getElementById("userFollowerCount").textContent = followerCount;

  // 渲染他的成就徽章
  document.getElementById("userBadges").innerHTML = getUserBadges(activeViewUserId);

  // 渲染關注狀態與關注按鈕
  const followBtn = document.getElementById("followBtn");
  if (currentUser) {
    const isFollowing = targetUser.followers && targetUser.followers.includes(currentUser.id);
    if (isFollowing) {
      followBtn.textContent = "✓ 已關注";
      followBtn.className = "secondary-btn";
    } else {
      followBtn.textContent = "🐾 關注";
      followBtn.className = "primary-btn";
    }
  } else {
    // 未登入狀態按鈕預設為「關注」
    followBtn.textContent = "🐾 關注";
    followBtn.className = "primary-btn";
  }

  // 渲染該使用者的貼文紀錄格柵
  document.getElementById("userPosts").innerHTML = userPosts.length
    ? userPosts.map(post => postCard(post, false)).join("")
    : `<div class="empty">此居民目前尚未分享任何毛孩點滴 🐾</div>`;
}

/**
 * 關注 / 取消關注他人的切換邏輯
 */
function toggleFollow() {
  if (!currentUser) {
    askLogin();
    return;
  }

  const targetUser = users.find(u => u.id === activeViewUserId);
  if (!targetUser) return;

  if (!targetUser.followers) {
    targetUser.followers = [];
  }

  const followerIdx = targetUser.followers.indexOf(currentUser.id);
  
  if (followerIdx > -1) {
    // 已經關注，本次動作為「取消關注」
    targetUser.followers.splice(followerIdx, 1);
    toast(`已取消關注 ${targetUser.name}`, "🐾");
  } else {
    // 未關注，本次動作為「新增關注」
    targetUser.followers.push(currentUser.id);
    toast(`🎉 成功關注了 ${targetUser.name}！`, "💖");
    // 播放炫酷愛心噴散特效！
    spawnHeartsEffect();
  }

  saveData();
  renderUserProfile(); // 即時重新渲染數據與按鈕狀態
}

/**
 * 動態產生懸浮飛舞愛心與小爪印特效粒子
 */
function spawnHeartsEffect() {
  const container = document.querySelector("#userPage .profile-avatar-container");
  if (!container) return;

  const iconsPool = ["❤️", "💖", "🐾", "✨", "🌟"];

  for (let i = 0; i < 8; i++) {
    const heart = document.createElement("div");
    heart.textContent = iconsPool[Math.floor(Math.random() * iconsPool.length)];
    heart.style.position = "absolute";
    heart.style.left = "50%";
    heart.style.bottom = "0";
    heart.style.fontSize = Math.floor(Math.random() * 14 + 16) + "px"; // 16px - 30px
    heart.style.pointerEvents = "none";
    heart.style.zIndex = "100";
    heart.style.transition = "all 1.2s cubic-bezier(0.075, 0.82, 0.165, 1)";
    heart.style.transform = "translateX(-50%) translateY(0) scale(0.3)";
    heart.style.opacity = "1";
    
    container.appendChild(heart);

    // 強制觸發 CSS 重繪以啟動 Transition 動畫
    setTimeout(() => {
      const randomX = (Math.random() - 0.5) * 120; // 飄動左右幅寬
      const randomY = Math.random() * 120 + 90;    // 向上飄升高度
      heart.style.transform = `translate(calc(-50% + ${randomX}px), -${randomY}px) scale(1.3) rotate(${(Math.random() - 0.5) * 45}deg)`;
      heart.style.opacity = "0";
    }, 50);

    // 動畫結束後徹底刪除 DOM 避免記憶體洩漏
    setTimeout(() => {
      heart.remove();
    }, 1250);
  }
}

/**
 * 動態演算評定使用者的「成就徽章」系統，回傳精美 HTML
 * @param {string} userId 使用者 ID
 * @returns {string} 徽章的 HTML
 */
function getUserBadges(userId) {
  const userPosts = posts.filter(p => p.authorId === userId);
  const totalLikesReceived = userPosts.reduce((sum, p) => sum + (p.likes ? p.likes.length : 0), 0);
  
  const userObj = users.find(u => u.id === userId);
  const followersCount = (userObj && userObj.followers) ? userObj.followers.length : 0;

  const badgeHtmls = [];

  // 1. 發文活躍徽章
  if (userPosts.length === 0) {
    badgeHtmls.push(`<span class="achievement-badge novice" title="尚未發表過貼文">🔰 星球萌新</span>`);
  } else if (userPosts.length >= 8) {
    badgeHtmls.push(`<span class="achievement-badge" title="發表貼文數達 8 篇以上">✍️ 創作大師</span>`);
  } else if (userPosts.length >= 3) {
    badgeHtmls.push(`<span class="achievement-badge" title="發表貼文數達 3 篇以上">📝 勤奮小作家</span>`);
  } else {
    badgeHtmls.push(`<span class="achievement-badge novice" title="已開始分享生活">🐾 星球居民</span>`);
  }

  // 2. 人氣與關注度徽章
  if (totalLikesReceived >= 15 || followersCount >= 6) {
    badgeHtmls.push(`<span class="achievement-badge star" title="獲得讚數達 15 以上或粉絲數達 6 以上">🌟 璀璨巨星</span>`);
  } else if (totalLikesReceived >= 4 || followersCount >= 1) {
    badgeHtmls.push(`<span class="achievement-badge star" title="獲得讚數達 4 以上或擁有粉絲">🌟 人氣紅人</span>`);
  }

  return badgeHtmls.join("");
}

// ------------------------------------------
// ✍️ 發文頁邏輯 (Category Select、上傳清除)
// ------------------------------------------

/**
 * 開啟發文編輯頁面
 */
function openPostPage() {
  if (!currentUser) {
    askLogin();
    return;
  }

  // 設定編輯器上方帳號資訊
  document.getElementById("editorAvatar").src = currentUser.avatar || defaultAvatar;
  document.getElementById("editorName").textContent = currentUser.name;
  document.getElementById("editorId").textContent = `@${currentUser.id}`;

  // 初始化重置各輸入欄位與視覺分類按鈕
  document.getElementById("postCategory").value = "日常分享";
  const defaultCategoryBtn = document.querySelector(".category-select-btn[data-value='日常分享']");
  if (defaultCategoryBtn) {
    selectPostCategory("日常分享", defaultCategoryBtn);
  }

  document.getElementById("postTitle").value = "";
  document.getElementById("postContent").value = "";
  document.getElementById("contentCounter").textContent = "0 / 500";
  
  // 清除貼文圖片狀態
  clearPostImage();

  showPage("postPage");
}

/**
 * 點選分類卡片按鈕時更新隱藏的 select 與視覺焦點
 */
function selectPostCategory(category, btn) {
  // 更新原 select 值，保障資料相容性
  document.getElementById("postCategory").value = category;
  
  // 移除同儕按鈕 active，高亮當前按鈕
  const btns = document.querySelectorAll(".category-select-btn");
  btns.forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

/**
 * 真正將新貼文發布
 */
async function publishPost() {
  const category = document.getElementById("postCategory").value;
  const title = document.getElementById("postTitle").value.trim();
  const content = document.getElementById("postContent").value.trim();
  const imageFile = document.getElementById("postImage").files[0];

  if (!title || !content) {
    toast("請輸入發布主題與發布內容", "⚠️");
    return;
  }

  // 如果有選擇圖片，則將其轉為 Base64 字串
  const image = imageFile ? await fileToBase64(imageFile) : "";

  const newPost = {
    postId: Date.now().toString(),
    authorId: currentUser.id,
    authorName: currentUser.name,
    authorAvatar: currentUser.avatar || defaultAvatar,
    category,
    title,
    content,
    image,
    likes: [],
    comments: [],
    createdAt: new Date().toLocaleString("zh-TW")
  };

  // 將新發文插入到貼文陣列的最前端
  posts.unshift(newPost);
  saveData();

  toast("恭喜！貼文已順利發布成功 ✨", "🎉");
  showPage("sharePage");
}

// ------------------------------------------
// 📢 分享區主頁渲染 (Filter、Search)
// ------------------------------------------

/**
 * 依分類篩選與關鍵字搜尋，渲染出貼文卡片列表
 */
function renderAllPosts() {
  const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
  const category = document.getElementById("categoryFilter").value;

  let filtered = posts.filter(post => {
    // 搜尋比對：包含主題、發文內容、作者 ID、作者名稱
    const matchKeyword =
      post.title.toLowerCase().includes(keyword) ||
      post.content.toLowerCase().includes(keyword) ||
      post.authorId.toLowerCase().includes(keyword) ||
      post.authorName.toLowerCase().includes(keyword);

    const matchCategory = category === "all" || post.category === category;

    return matchKeyword && matchCategory;
  });

  // 更新顯示「共幾篇」貼文
  document.getElementById("postCountText").textContent = `目前共有 ${filtered.length} 篇貼文`;

  // 渲染貼文卡片列表
  document.getElementById("allPosts").innerHTML = filtered.length
    ? filtered.map(post => postCard(post, false)).join("")
    : `<div class="empty">目前找不到符合條件的毛孩貼文 🐾</div>`;
}

/**
 * 組合生成單個貼文卡片的 HTML 字串
 * @param {object} post 貼文結構資料
 * @param {boolean} isProfilePage 是否為個人檔案頁（用以刪除與讚狀態判定）
 */
function postCard(post, isProfilePage) {
  const liked = currentUser && post.likes && post.likes.includes(currentUser.id);

  // 拼接該貼文底下的所有留言列表
  const commentsHtml = post.comments && post.comments.length
    ? post.comments.map(comment => `
      <div class="comment">
        <strong>${escapeHtml(comment.name)}</strong>
        <span class="comment-meta" onclick="viewUserProfile('${comment.id}')" style="cursor:pointer;hover:text-decoration:underline;">@${escapeHtml(comment.id)}・${escapeHtml(comment.createdAt)}</span>
        <div>${escapeHtml(comment.text)}</div>
      </div>
    `).join("")
    : `<div class="comment empty" style="border:none;padding:12px;background:none;text-align:left;">💬 搶先成為這篇貼文的第一個留言者喵！🐾</div>`;

  return `
    <article class="post-card">
      <div class="post-user">
        <img class="avatar" src="${post.authorAvatar || defaultAvatar}" alt="頭貼" onclick="viewUserProfile('${post.authorId}')">
        <div>
          <strong onclick="viewUserProfile('${post.authorId}')">${escapeHtml(post.authorName)}</strong>
          <p onclick="viewUserProfile('${post.authorId}')" style="cursor:pointer;">@${escapeHtml(post.authorId)}・${escapeHtml(post.createdAt)}</p>
        </div>
      </div>

      <span class="category">${escapeHtml(post.category || "其他")}</span>
      <h3>${escapeHtml(post.title)}</h3>
      <div class="post-content">${escapeHtml(post.content)}</div>
      ${post.image ? `<img class="post-img" src="${post.image}" alt="貼文圖片">` : ""}

      <div class="post-actions">
        <button class="icon-btn ${liked ? "active" : ""}" id="like-btn-${post.postId}" onclick="toggleLike('${post.postId}', ${isProfilePage})">
          ❤️ 按讚 ${post.likes ? post.likes.length : 0}
        </button>
        <button class="icon-btn" onclick="focusComment('${post.postId}')">
          💬 留言 ${post.comments ? post.comments.length : 0}
        </button>
        ${currentUser && currentUser.id === post.authorId ? `
          <button class="icon-btn" style="border-color:#ffccd2;color:var(--deep-pink);background:#fff9fa;" onclick="deletePost('${post.postId}', ${isProfilePage})">🗑️ 刪除</button>
        ` : ""}
      </div>

      <div class="comment-box">
        ${currentUser ? `
          <div class="comment-row">
            <input id="comment-${post.postId}" type="text" placeholder="寫點好玩的留言討論吧..." maxlength="100">
            <button class="primary-btn" onclick="addComment('${post.postId}', ${isProfilePage})">送出</button>
          </div>
        ` : `
          <button class="secondary-btn" style="width:100%;" onclick="askLogin()">🔒 登入後方能加入留言討論</button>
        `}
        ${commentsHtml}
      </div>
    </article>
  `;
}

// ------------------------------------------
// 💖 按讚與留言邏輯 (Likes & Comments)
// ------------------------------------------

/**
 * 按讚或取消按讚貼文
 */
function toggleLike(postId, isProfilePage) {
  if (!currentUser) {
    askLogin();
    return;
  }

  const post = posts.find(p => p.postId === postId);
  if (!post) return;

  if (!post.likes) post.likes = [];

  const index = post.likes.indexOf(currentUser.id);
  
  if (index > -1) {
    // 已經按讚，取消讚
    post.likes.splice(index, 1);
  } else {
    // 尚未按讚，點讚
    post.likes.push(currentUser.id);
    
    // 按讚心跳彈跳特效
    const likeBtn = document.getElementById(`like-btn-${postId}`);
    if (likeBtn) {
      likeBtn.style.transform = "scale(1.3) rotate(-5deg)";
      setTimeout(() => {
        likeBtn.style.transform = "";
      }, 250);
    }
  }

  saveData();
  
  // 局部或完整刷新頁面以更新按讚數量渲染
  isProfilePage ? renderHome() : renderAllPosts();
}

/**
 * 點擊留言按鈕時自動聚焦輸入框
 */
function focusComment(postId) {
  if (!currentUser) {
    askLogin();
    return;
  }

  const input = document.getElementById(`comment-${postId}`);
  if (input) {
    input.focus();
    // 滑動使該輸入框稍微居中
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/**
 * 新增留言至貼文
 */
function addComment(postId, isProfilePage) {
  if (!currentUser) {
    askLogin();
    return;
  }

  const input = document.getElementById(`comment-${postId}`);
  const text = input.value.trim();

  if (!text) {
    toast("請輸入一些留言文字喵！🐾", "⚠️");
    return;
  }

  const post = posts.find(p => p.postId === postId);
  if (!post) return;

  if (!post.comments) post.comments = [];

  post.comments.push({
    id: currentUser.id,
    name: currentUser.name,
    text,
    createdAt: new Date().toLocaleString("zh-TW")
  });

  saveData();
  
  input.value = ""; // 清空留言輸入框
  toast("✨ 成功發布了留言！", "💬");

  isProfilePage ? renderHome() : renderAllPosts();
}

// ------------------------------------------
// 🗑️ 自訂刪除確認視窗與刪除貼文邏輯
// ------------------------------------------

/**
 * 攔截並觸發自訂貼文刪除對話 Modal，取代原生 confirm
 */
function deletePost(postId, isProfilePage) {
  pendingDeletePostId = postId;
  pendingDeleteIsProfilePage = isProfilePage;
  
  // 顯示刪除確認視窗：移除 hidden 並加上 active
  const modal = document.getElementById("deleteConfirmModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("active");
  }
}

/**
 * 關閉自訂刪除對話 Modal
 */
function closeDeleteConfirmModal() {
  const modal = document.getElementById("deleteConfirmModal");
  if (modal) {
    modal.classList.remove("active");
    modal.classList.add("hidden");
  }
  pendingDeletePostId = "";
}

/**
 * 綁定自訂確認刪除視窗的「確認刪除」按鈕事件，以及「點擊背景遮罩關閉」事件
 */
function bindConfirmDeleteBtn() {
  const btn = document.getElementById("confirmDeleteBtn");
  if (btn) {
    btn.onclick = () => {
      if (!pendingDeletePostId) return;

      const postId = pendingDeletePostId;
      const isProfilePage = pendingDeleteIsProfilePage;

      // 真正過濾並刪除該貼文
      posts = posts.filter(p => p.postId !== postId);
      saveData();

      closeDeleteConfirmModal(); // 關閉 Modal
      toast("該貼文已從星際刪除成功！🐾", "🗑️");

      isProfilePage ? renderHome() : renderAllPosts();
    };
  }

  // 綁定背景遮罩點擊關閉
  const overlay = document.getElementById("deleteConfirmModal");
  if (overlay) {
    overlay.onclick = (e) => {
      // 只有點擊到遮罩本體 (overlay)，而非內部的卡片 (modal-card) 時才關閉
      if (e.target === overlay) {
        closeDeleteConfirmModal();
      }
    };
  }
}

// ------------------------------------------
// 💬 全域輔助與精緻 UI 回饋 (Toast, Escape, Prompt)
// ------------------------------------------

/**
 * 未登入操作功能限制提示，引導轉至登入註冊頁
 */
function askLogin() {
  // 為增進體驗，此處可選保留 confirm 做攔截跳轉
  const ok = confirm("是否有毛孩星球專屬帳號？請先登入或註冊，方可開啟發文、按讚與留言等完整功能！🐾");
  if (ok) showPage("authPage");
}

/**
 * 顯示帶有精美動畫與隨機/自訂寵物 Emojis 的 Toast 懸浮提示框
 * @param {string} message 提示文字內容
 * @param {string} [emoji] 可選自訂 Emoji 圖示
 */
function toast(message, emoji) {
  const box = document.getElementById("toast");
  if (!box) return;

  const emojiPool = ["🐶", "🐱", "🐰", "🐾", "✨", "🍖"];
  const selectedEmoji = emoji || emojiPool[Math.floor(Math.random() * emojiPool.length)];

  box.innerHTML = `<span>${selectedEmoji}</span> <div>${message}</div>`;
  box.classList.remove("hidden");

  // 先清空計時器防閃爍，並設定 2.5 秒後淡出隱藏
  if (box.timeoutId) clearTimeout(box.timeoutId);
  
  box.timeoutId = setTimeout(() => {
    box.classList.add("hidden");
  }, 2200);
}

/**
 * 避免 HTML 注入攻擊 (XSS) 的轉義字串安全函數
 */
function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
