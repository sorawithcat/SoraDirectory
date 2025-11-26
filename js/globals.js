// ============================================
// 全局变量和DOM引用模块 (globals.js)
// 功能：定义全局变量和DOM元素引用
// ============================================

// 储存目录文件
let mulufile = [];

// 新/旧的目录名
let newName, oldName;

// 所选择的目录
let currentMuluName = null;

// 预览区域更新标志
let isUpdating = false;

// 所有物体
const body = document.querySelector("body");
const allThins = body.querySelectorAll("*");

// 包裹目录的两个盒子
const bigbox = document.querySelector(".bigbox");
const showbox = document.querySelector(".showbox");

// 所有的目录
const mulus = document.querySelectorAll(".mulu");

// 目录容器
const firststep = document.querySelector(".firststep");

// 目录主体
const mulubox = document.querySelector(".mulubox");

// 按钮容器
// 添加目录
const addNewMuluButton = document.querySelector(".addNewMuluButton");

// 添加新节点
const addNewPotsButton = document.querySelector(".addNewPotsButton");

// 顶部工具栏按钮
const newBtn = document.getElementById("newBtn");
const topSaveBtn = document.getElementById("saveBtn");
const saveAsBtn = document.getElementById("saveAsBtn");
const topLoadBtn = document.getElementById("loadBtn");
const expandAllBtn = document.getElementById("expandAllBtn");
const collapseAllBtn = document.getElementById("collapseAllBtn");
const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const topImageUploadBtn = document.getElementById("topImageUploadBtn");
const topLinkBtn = document.getElementById("topLinkBtn");
const topToolbar = document.getElementById("topToolbar");

// 节点内容容器
const jiedianwords = document.querySelector(".jiedianwords");
const markdownPreview = document.querySelector(".markdown-preview");
const textFormatToolbar = document.querySelector(".text-format-toolbar");
const imageUploadBtn = document.getElementById("imageUploadBtn");
const imageFileInput = document.getElementById("imageFileInput");

// 节点盒子
const wordsbox = document.querySelector(".wordsbox");

// 右键菜单
const rightmousemenu = document.querySelector(".rightmousemenu");

// 右键-删除
const deleteMulu = document.querySelector(".deleteMulu");

// 右键-取消
const noneRightMouseMenu = document.querySelector(".noneRightMouseMenu");

// 右键-展开所有目录
const showAllMulu = document.querySelector(".showAllMulu");

// 右键-收缩所有目录
const cutAllMulu = document.querySelector(".cutAllMulu");

