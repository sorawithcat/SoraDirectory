const searchDialogOverlay = document.getElementById('searchDialogOverlay');
const searchDialog = document.getElementById('searchDialog');
const searchDialogTitle = document.getElementById('searchDialogTitle');
const searchDialogClose = document.getElementById('searchDialogClose');
const searchInput = document.getElementById('searchInput');
const replaceInput = document.getElementById('replaceInput');
const replaceInputGroup = document.getElementById('replaceInputGroup');
const searchCaseSensitive = document.getElementById('searchCaseSensitive');
const searchWholeWord = document.getElementById('searchWholeWord');
const searchRegex = document.getElementById('searchRegex');
const searchScope = document.getElementById('searchScope');
const searchResults = document.getElementById('searchResults');
const searchInfo = document.getElementById('searchInfo');
const searchPrevBtn = document.getElementById('searchPrevBtn');
const searchNextBtn = document.getElementById('searchNextBtn');
const replaceOneBtn = document.getElementById('replaceOneBtn');
const replaceAllBtn = document.getElementById('replaceAllBtn');
const searchBtn = document.getElementById('searchBtn');
const replaceBtn = document.getElementById('replaceBtn');
let searchState = {
    isReplaceMode: false,
    results: [],           
    currentResultIndex: -1,
    currentMatchIndex: -1,
    searchText: '',
    lastSearchText: ''
};
/**
 * 打开查找对话框
 * @param {boolean} replaceMode - 是否为替换模式
 */
function openSearchDialog(replaceMode = false) {
    searchState.isReplaceMode = replaceMode;
    searchDialogTitle.textContent = replaceMode ? '查找和替换' : '查找';
    replaceInputGroup.style.display = replaceMode ? 'block' : 'none';
    replaceOneBtn.style.display = replaceMode ? 'inline-block' : 'none';
    replaceAllBtn.style.display = replaceMode ? 'inline-block' : 'none';
    searchDialogOverlay.classList.add('active');
    const selection = window.getSelection();
    if (selection.toString().trim()) {
        searchInput.value = selection.toString().trim();
    }
    setTimeout(() => {
        searchInput.focus();
        searchInput.select();
    }, 100);
    if (searchInput.value.trim()) {
        performSearch();
    }
}
/**
 * 关闭查找对话框
 */
function closeSearchDialog() {
    searchDialogOverlay.classList.remove('active');
    clearHighlights();
    searchState.results = [];
    searchState.currentResultIndex = -1;
    searchState.currentMatchIndex = -1;
    searchResults.style.display = 'none';
    searchResults.innerHTML = '';
}
/**
 * 执行搜索
 */
function performSearch() {
    const searchText = searchInput.value;
    if (!searchText.trim()) {
        searchState.results = [];
        updateSearchInfo();
        searchResults.style.display = 'none';
        return;
    }
    if (currentMuluName) {
        syncPreviewToTextarea();
    }
    searchState.searchText = searchText;
    searchState.results = [];
    searchState.currentResultIndex = -1;
    searchState.currentMatchIndex = -1;
    const caseSensitive = searchCaseSensitive.checked;
    const wholeWord = searchWholeWord.checked;
    const useRegex = searchRegex.checked;
    const scope = searchScope.value;
    let regex;
    try {
        let pattern = searchText;
        if (!useRegex) {
            pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        if (wholeWord) {
            pattern = `\\b${pattern}\\b`;
        }
        regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    } catch (e) {
        searchInfo.textContent = '正则表达式无效';
        return;
    }
    if (scope === 'current') {
        if (currentMuluName) {
            const currentMulu = document.getElementById(currentMuluName);
            if (currentMulu) {
                const dirId = currentMulu.getAttribute('data-dir-id');
                const dirName = currentMulu.innerHTML;
                const content = jiedianwords.value;
                const matches = findMatches(content, regex);
                if (matches.length > 0) {
                    searchState.results.push({
                        dirId,
                        dirName,
                        domId: currentMuluName,
                        content,
                        matches
                    });
                }
            }
        }
    } else {
        const allMulus = document.querySelectorAll('.mulu');
        allMulus.forEach(mulu => {
            const dirId = mulu.getAttribute('data-dir-id');
            const dirName = mulu.innerHTML;
            let content = '';
            for (let i = 0; i < mulufile.length; i++) {
                if (mulufile[i].length === 4 && mulufile[i][2] === dirId) {
                    content = mulufile[i][3];
                    break;
                }
            }
            const matches = findMatches(content, regex);
            if (matches.length > 0) {
                searchState.results.push({
                    dirId,
                    dirName,
                    domId: mulu.id,
                    content,
                    matches
                });
            }
        });
    }
    updateSearchInfo();
    renderSearchResults();
    if (searchState.results.length > 0) {
        navigateToResult(0, 0);
    }
}
/**
 * 在内容中查找匹配项
 * @param {string} content - 要搜索的内容
 * @param {RegExp} regex - 正则表达式
 * @returns {Array} - 匹配项数组
 */
function findMatches(content, regex) {
    const matches = [];
    const textContent = content.replace(/<[^>]*>/g, ' ');
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(textContent)) !== null) {
        matches.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0]
        });
        if (match[0].length === 0) {
            regex.lastIndex++;
        }
    }
    return matches;
}
/**
 * 更新搜索信息
 */
function updateSearchInfo() {
    const totalMatches = searchState.results.reduce((sum, r) => sum + r.matches.length, 0);
    if (!searchInput.value.trim()) {
        searchInfo.textContent = '输入内容开始查找';
        searchPrevBtn.disabled = true;
        searchNextBtn.disabled = true;
        replaceOneBtn.disabled = true;
        replaceAllBtn.disabled = true;
    } else if (totalMatches === 0) {
        searchInfo.textContent = '未找到匹配项';
        searchPrevBtn.disabled = true;
        searchNextBtn.disabled = true;
        replaceOneBtn.disabled = true;
        replaceAllBtn.disabled = true;
    } else {
        const currentPos = getCurrentPosition();
        searchInfo.textContent = `${currentPos} / ${totalMatches} 个结果（${searchState.results.length} 个目录）`;
        searchPrevBtn.disabled = false;
        searchNextBtn.disabled = false;
        replaceOneBtn.disabled = false;
        replaceAllBtn.disabled = false;
    }
}
/**
 * 获取当前位置
 */
function getCurrentPosition() {
    if (searchState.currentResultIndex < 0) return 0;
    let pos = 0;
    for (let i = 0; i < searchState.currentResultIndex; i++) {
        pos += searchState.results[i].matches.length;
    }
    pos += searchState.currentMatchIndex + 1;
    return pos;
}
/**
 * 渲染搜索结果列表
 */
function renderSearchResults() {
    if (searchState.results.length === 0) {
        searchResults.style.display = 'none';
        return;
    }
    searchResults.style.display = 'block';
    searchResults.innerHTML = '';
    searchState.results.forEach((result, resultIndex) => {
        result.matches.forEach((match, matchIndex) => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.setAttribute('data-result-index', resultIndex);
            item.setAttribute('data-match-index', matchIndex);
            const textContent = result.content.replace(/<[^>]*>/g, ' ');
            const contextStart = Math.max(0, match.start - 30);
            const contextEnd = Math.min(textContent.length, match.end + 30);
            let context = textContent.substring(contextStart, contextEnd);
            const matchStart = match.start - contextStart;
            const matchEnd = match.end - contextStart;
            context = escapeHtml(context.substring(0, matchStart)) +
                      '<mark>' + escapeHtml(context.substring(matchStart, matchEnd)) + '</mark>' +
                      escapeHtml(context.substring(matchEnd));
            if (contextStart > 0) context = '...' + context;
            if (contextEnd < textContent.length) context += '...';
            item.innerHTML = `
                <div class="search-result-dir">${escapeHtml(result.dirName)}</div>
                <div class="search-result-context">${context}</div>
            `;
            item.addEventListener('click', () => {
                navigateToResult(resultIndex, matchIndex);
            });
            searchResults.appendChild(item);
        });
    });
}
/**
 * 展开目录的所有父目录，确保目录可见
 * @param {HTMLElement} targetMulu - 目标目录元素
 */
function expandParentDirectories(targetMulu) {
    if (!targetMulu) return;
    const parentsToExpand = [];
    let parentId = targetMulu.getAttribute('data-parent-id');
    while (parentId && parentId !== 'mulu') {
        const parentMulu = document.querySelector(`[data-dir-id="${parentId}"]`);
        if (parentMulu) {
            parentsToExpand.unshift(parentMulu); 
            parentId = parentMulu.getAttribute('data-parent-id');
        } else {
            break;
        }
    }
    parentsToExpand.forEach(parent => {
        const dirId = parent.getAttribute('data-dir-id');
        parent.style.display = 'block';
        if (parent.classList.contains('has-children')) {
            parent.classList.add('expanded');
        }
        if (dirId) {
            toggleChildDirectories(dirId, true);
        }
    });
    targetMulu.style.display = 'block';
}
/**
 * 导航到指定结果
 */
function navigateToResult(resultIndex, matchIndex) {
    if (resultIndex < 0 || resultIndex >= searchState.results.length) return;
    const result = searchState.results[resultIndex];
    if (matchIndex < 0 || matchIndex >= result.matches.length) return;
    clearHighlights(true);
    const targetMulu = document.getElementById(result.domId);
    if (targetMulu) {
        expandParentDirectories(targetMulu);
        RemoveOtherSelect();
        targetMulu.classList.add('select');
        currentMuluName = result.domId;
        jiedianwords.value = result.content;
        isUpdating = true;
        updateMarkdownPreview();
        isUpdating = false;
        setTimeout(() => {
            targetMulu.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
    }
    searchState.currentResultIndex = resultIndex;
    searchState.currentMatchIndex = matchIndex;
    updateResultListHighlight();
    highlightCurrentMatch();
    updateSearchInfo();
}
/**
 * 更新结果列表高亮
 */
function updateResultListHighlight() {
    const items = searchResults.querySelectorAll('.search-result-item');
    let currentItemIndex = 0;
    for (let i = 0; i < searchState.currentResultIndex; i++) {
        currentItemIndex += searchState.results[i].matches.length;
    }
    currentItemIndex += searchState.currentMatchIndex;
    items.forEach((item, index) => {
        if (index === currentItemIndex) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}
/**
 * 高亮当前匹配项
 */
function highlightCurrentMatch() {
    if (!markdownPreview) return;
    clearHighlights();
    const result = searchState.results[searchState.currentResultIndex];
    if (!result) return;
    const searchText = searchState.searchText;
    const caseSensitive = searchCaseSensitive.checked;
    const wholeWord = searchWholeWord.checked;
    const useRegex = searchRegex.checked;
    highlightTextInElement(markdownPreview, searchText, caseSensitive, wholeWord, useRegex, searchState.currentMatchIndex);
}
/**
 * 在元素中高亮文本
 */
function highlightTextInElement(element, searchText, caseSensitive, wholeWord, useRegex, currentIndex) {
    if (!searchText) return;
    let pattern = searchText;
    if (!useRegex) {
        pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    if (wholeWord) {
        pattern = `\\b${pattern}\\b`;
    }
    const regex = new RegExp(`(${pattern})`, caseSensitive ? 'g' : 'gi');
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }
    let matchCount = 0;
    textNodes.forEach(textNode => {
        const text = textNode.nodeValue;
        if (regex.test(text)) {
            regex.lastIndex = 0;
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            let match;
            while ((match = regex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
                }
                const span = document.createElement('span');
                span.className = matchCount === currentIndex ? 'search-highlight search-highlight-current' : 'search-highlight';
                span.textContent = match[0];
                fragment.appendChild(span);
                lastIndex = regex.lastIndex;
                matchCount++;
                if (match[0].length === 0) {
                    regex.lastIndex++;
                }
            }
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }
            textNode.parentNode.replaceChild(fragment, textNode);
        }
    });
    batchDOMUpdate(() => {
        const currentHighlight = element.querySelector('.search-highlight-current');
        if (currentHighlight) {
            currentHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
}
/**
 * 清除所有高亮
 * @param {boolean} syncData - 是否同步更新数据，默认 true
 */
function clearHighlights(syncData = true) {
    if (!markdownPreview) return;
    const highlights = markdownPreview.querySelectorAll('.search-highlight, .search-highlight-current');
    if (highlights.length === 0) return;
    highlights.forEach(span => {
        const text = span.textContent;
        const textNode = document.createTextNode(text);
        span.parentNode.replaceChild(textNode, span);
    });
    markdownPreview.normalize();
    if (syncData && currentMuluName) {
        const currentMulu = document.getElementById(currentMuluName);
        if (currentMulu) {
            jiedianwords.value = markdownPreview.innerHTML;
            updateMulufileData(currentMulu, markdownPreview.innerHTML);
        }
    }
}
/**
 * 从内容字符串中移除高亮标签
 * @param {string} content - 内容字符串
 * @returns {string} - 清理后的内容
 */
function removeHighlightTags(content) {
    if (!content) return content;
    return content
        .replace(/<span class="search-highlight[^"]*">/g, '')
        .replace(/<\/span>/g, '');
}
/**
 * 下一个匹配项
 */
function nextMatch() {
    if (searchState.results.length === 0) return;
    let resultIndex = searchState.currentResultIndex;
    let matchIndex = searchState.currentMatchIndex + 1;
    if (resultIndex < 0) {
        resultIndex = 0;
        matchIndex = 0;
    } else if (matchIndex >= searchState.results[resultIndex].matches.length) {
        resultIndex++;
        matchIndex = 0;
        if (resultIndex >= searchState.results.length) {
            resultIndex = 0;
        }
    }
    navigateToResult(resultIndex, matchIndex);
}
/**
 * 上一个匹配项
 */
function prevMatch() {
    if (searchState.results.length === 0) return;
    let resultIndex = searchState.currentResultIndex;
    let matchIndex = searchState.currentMatchIndex - 1;
    if (resultIndex < 0) {
        resultIndex = searchState.results.length - 1;
        matchIndex = searchState.results[resultIndex].matches.length - 1;
    } else if (matchIndex < 0) {
        resultIndex--;
        if (resultIndex < 0) {
            resultIndex = searchState.results.length - 1;
        }
        matchIndex = searchState.results[resultIndex].matches.length - 1;
    }
    navigateToResult(resultIndex, matchIndex);
}
/**
 * 替换当前匹配项
 */
function replaceOne() {
    if (searchState.currentResultIndex < 0) return;
    const result = searchState.results[searchState.currentResultIndex];
    if (!result) return;
    const replaceText = replaceInput.value;
    const caseSensitive = searchCaseSensitive.checked;
    const wholeWord = searchWholeWord.checked;
    const useRegex = searchRegex.checked;
    let pattern = searchState.searchText;
    if (!useRegex) {
        pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    if (wholeWord) {
        pattern = `\\b${pattern}\\b`;
    }
    const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    let matchCount = 0;
    const newContent = result.content.replace(regex, (match) => {
        if (matchCount === searchState.currentMatchIndex) {
            matchCount++;
            return replaceText;
        }
        matchCount++;
        return match;
    });
    for (let i = 0; i < mulufile.length; i++) {
        if (mulufile[i].length === 4 && mulufile[i][2] === result.dirId) {
            mulufile[i][3] = newContent;
            break;
        }
    }
    if (currentMuluName === result.domId) {
        jiedianwords.value = newContent;
        isUpdating = true;
        updateMarkdownPreview();
        isUpdating = false;
    }
    showToast('已替换 1 处', 'success', 2000);
    performSearch();
}
/**
 * 替换所有匹配项
 */
function replaceAll() {
    if (searchState.results.length === 0) return;
    const replaceText = replaceInput.value;
    const caseSensitive = searchCaseSensitive.checked;
    const wholeWord = searchWholeWord.checked;
    const useRegex = searchRegex.checked;
    let pattern = searchState.searchText;
    if (!useRegex) {
        pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    if (wholeWord) {
        pattern = `\\b${pattern}\\b`;
    }
    const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    let totalReplaced = 0;
    searchState.results.forEach(result => {
        const originalContent = result.content;
        const newContent = originalContent.replace(regex, replaceText);
        if (newContent !== originalContent) {
            const matchCount = (originalContent.match(regex) || []).length;
            totalReplaced += matchCount;
            for (let i = 0; i < mulufile.length; i++) {
                if (mulufile[i].length === 4 && mulufile[i][2] === result.dirId) {
                    mulufile[i][3] = newContent;
                    break;
                }
            }
            if (currentMuluName === result.domId) {
                jiedianwords.value = newContent;
                isUpdating = true;
                updateMarkdownPreview();
                isUpdating = false;
            }
        }
    });
    showToast(`已替换 ${totalReplaced} 处`, 'success', 2000);
    performSearch();
}
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
if (searchDialog) {
    const header = searchDialog.querySelector('.search-dialog-header');
    if (header) {
        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('search-dialog-close')) return;
            isDragging = true;
            const rect = searchDialog.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
            e.preventDefault();
        });
    }
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newX = e.clientX - dragOffsetX;
        let newY = e.clientY - dragOffsetY;
        const maxX = window.innerWidth - searchDialog.offsetWidth;
        const maxY = window.innerHeight - searchDialog.offsetHeight;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        searchDialog.style.left = newX + 'px';
        searchDialog.style.right = 'auto';
        searchDialog.style.top = newY + 'px';
    });
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}
if (searchBtn) {
    searchBtn.addEventListener('click', () => openSearchDialog(false));
}
if (replaceBtn) {
    replaceBtn.addEventListener('click', () => openSearchDialog(true));
}
if (searchDialogClose) {
    searchDialogClose.addEventListener('click', closeSearchDialog);
}
if (searchDialogOverlay) {
    searchDialogOverlay.addEventListener('click', (e) => {
        if (e.target === searchDialogOverlay) {
        }
    });
}
if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performSearch, 300);
    });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                prevMatch();
            } else {
                nextMatch();
            }
        } else if (e.key === 'Escape') {
            closeSearchDialog();
        }
    });
}
if (replaceInput) {
    replaceInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            replaceOne();
        } else if (e.key === 'Escape') {
            closeSearchDialog();
        }
    });
}
[searchCaseSensitive, searchWholeWord, searchRegex, searchScope].forEach(el => {
    if (el) {
        el.addEventListener('change', performSearch);
    }
});
if (searchPrevBtn) searchPrevBtn.addEventListener('click', prevMatch);
if (searchNextBtn) searchNextBtn.addEventListener('click', nextMatch);
if (replaceOneBtn) replaceOneBtn.addEventListener('click', replaceOne);
if (replaceAllBtn) replaceAllBtn.addEventListener('click', replaceAll);
document.addEventListener('keydown', (e) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openSearchDialog(false);
    } else if (isCtrl && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        openSearchDialog(true);
    }
});