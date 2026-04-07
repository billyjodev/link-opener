// Link Opener - Core Logic

let detectedLinks = [];

// DOM Elements
const inputArea = document.getElementById('inputArea');
const linkList = document.getElementById('linkList');
const summary = document.getElementById('summary');
const btnSelectAll = document.getElementById('btnSelectAll');
const btnClearSelection = document.getElementById('btnClearSelection');
const btnClear = document.getElementById('btnClear');
const btnDownload = document.getElementById('btnDownload');
const btnOpen = document.getElementById('btnOpen');

// Extract links from HTML content
function extractLinksFromHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = [];

  // Extract from a[href] and area[href]
  const elements = doc.querySelectorAll('a[href], area[href]');
  elements.forEach(el => {
    const href = el.getAttribute('href');
    const text = el.textContent.trim() || el.getAttribute('alt') || el.getAttribute('title') || '';
    if (href) {
      try {
        // Handle file:// URLs directly
        if (href.startsWith('file://')) {
          links.push({ text: text || href, url: href });
          return;
        }
        const url = new URL(href, 'https://example.com');
        if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'file:') {
          links.push({ text: text || url.href, url: url.href });
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }
  });

  return links;
}

// Extract links from plain text using regex
function extractLinksFromText(text) {
  // URL regex for http://, https:// and file://
  const urlRegex = /(https?:\/\/|file:\/\/\/)[^\s<>"']+/g;
  const matches = text.match(urlRegex) || [];

  // Clean trailing punctuation: ) , . ; ! ?
  return matches.map(url => {
    const cleanUrl = url.replace(/[),.;!?]+$/, '');
    return { text: cleanUrl, url: cleanUrl };
  });
}

// Remove duplicates while preserving order (based on URL)
function removeDuplicates(links) {
  const seen = new Set();
  return links.filter(link => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

// Main link extraction function
function extractLinks(content, isHTML) {
  let links = [];

  if (isHTML) {
    links = extractLinksFromHTML(content);
  }

  // If no HTML links found, try plain text extraction
  if (links.length === 0) {
    links = extractLinksFromText(content);
  }

  return removeDuplicates(links);
}

// Truncate URL for display
function truncateUrl(url, maxLength = 60) {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
}

// Render link list
function renderLinks() {
  linkList.innerHTML = '';

  if (detectedLinks.length === 0) {
    linkList.style.display = 'none';
    updateSummary();
    updateButtons();
    return;
  }

  linkList.style.display = 'block';

  detectedLinks.forEach((linkObj, index) => {
    const item = document.createElement('div');
    item.className = 'link-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `link-${index}`;
    checkbox.checked = true;
    checkbox.addEventListener('change', updateSummary);
    checkbox.addEventListener('change', updateButtons);

    const label = document.createElement('label');
    label.htmlFor = `link-${index}`;

    // Create link text span
    const textSpan = document.createElement('span');
    textSpan.className = 'link-text';
    textSpan.textContent = linkObj.text;

    // Create URL span
    const urlSpan = document.createElement('span');
    urlSpan.className = 'link-url';
    urlSpan.textContent = ' (' + truncateUrl(linkObj.url) + ')';
    urlSpan.title = linkObj.url;

    label.appendChild(textSpan);
    label.appendChild(urlSpan);

    item.appendChild(checkbox);
    item.appendChild(label);
    linkList.appendChild(item);
  });

  updateSummary();
  updateButtons();
}

// Get selected links
function getSelectedLinks() {
  const checkboxes = linkList.querySelectorAll('input[type="checkbox"]');
  const selected = [];

  checkboxes.forEach((cb, index) => {
    if (cb.checked) {
      selected.push(detectedLinks[index].url);
    }
  });

  return selected;
}

// Update summary text
function updateSummary() {
  const total = detectedLinks.length;
  const selected = getSelectedLinks().length;

  if (total === 0) {
    summary.textContent = getLocalizedString('noLinks');
  } else {
    summary.innerHTML = getLocalizedString('selectedCount', selected, total);
  }
}

// Update button states
function updateButtons() {
  const total = detectedLinks.length;
  const selected = getSelectedLinks().length;

  btnSelectAll.disabled = total === 0;
  btnClearSelection.disabled = total === 0 || selected === 0;
  btnClear.disabled = total === 0;
  btnDownload.disabled = selected === 0;
  btnOpen.disabled = selected === 0;
}

// Handle paste event
function handlePaste(e) {
  let content = '';
  let isHTML = false;

  // Try text/html first
  const htmlData = e.clipboardData.getData('text/html');
  if (htmlData) {
    content = htmlData;
    isHTML = true;
  } else {
    content = e.clipboardData.getData('text/plain');
    isHTML = false;
  }

  if (content) {
    // Append to existing content
    const start = inputArea.selectionStart;
    const end = inputArea.selectionEnd;
    const before = inputArea.value.substring(0, start);
    const after = inputArea.value.substring(end);
    inputArea.value = before + content + after;

    processInput();
  }
}

// Process textarea input
function processInput() {
  const content = inputArea.value.trim();

  if (!content) {
    detectedLinks = [];
  } else {
    // Check if content looks like HTML
    const isHTML = /<[a-zA-Z][^>]*>/.test(content);
    detectedLinks = extractLinks(content, isHTML);
  }

  renderLinks();
}

// Select all links
function selectAll() {
  const checkboxes = linkList.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = true);
  updateSummary();
  updateButtons();
}

// Clear selection
function clearSelection() {
  const checkboxes = linkList.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = false);
  updateSummary();
  updateButtons();
}

// Clear all
function clearAll() {
  inputArea.value = '';
  detectedLinks = [];
  renderLinks();
}

// Download files from links
async function downloadLinks() {
  const selected = getSelectedLinks();
  if (selected.length === 0) return;

  btnDownload.disabled = true;
  btnDownload.textContent = getLocalizedString('downloading');

  let successCount = 0;
  let failCount = 0;

  for (const link of selected) {
    try {
      // Extract filename from URL
      const url = new URL(link);
      const pathname = url.pathname;
      let filename = pathname.substring(pathname.lastIndexOf('/') + 1) || 'download';

      // If no extension, try to get from content-type or add .bin
      if (!filename.includes('.')) {
        filename += '.bin';
      }

      // Create download link
      const a = document.createElement('a');
      a.href = link;
      a.download = filename;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      successCount++;

      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (e) {
      console.error('Download failed for:', link, e);
      failCount++;
    }
  }

  btnDownload.disabled = false;
  btnDownload.textContent = getLocalizedString('downloadBtn');
  updateButtons();

  if (failCount > 0) {
    alert(getLocalizedString('downloadResult', successCount, failCount));
  }
}

// Open links in new tabs
function openLinks() {
  const selected = getSelectedLinks();
  if (selected.length === 0) return;

  for (const link of selected) {
    const win = window.open(link, '_blank');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      alert(getLocalizedString('popupBlocked'));
      break;
    }
  }
}

// Localized strings (overridden by HTML files)
function getLocalizedString(key, ...args) {
  const strings = window.localizedStrings || {
    noLinks: 'No links detected yet.',
    selectedCount: `${args[0]} of ${args[1]} link(s) selected`,
    popupBlocked: 'Pop-up blocked. Please allow pop-ups for this site.',
    downloading: 'Downloading...',
    downloadBtn: 'Download links',
    downloadResult: `Downloaded ${args[0]}. ${args[1]} failed.`
  };

  switch (key) {
    case 'noLinks':
      return strings.noLinks || 'No links detected yet.';
    case 'selectedCount':
      return (strings.selectedCount || `${args[0]} of ${args[1]} link(s) selected`)
        .replace('{0}', args[0])
        .replace('{1}', args[1]);
    case 'popupBlocked':
      return strings.popupBlocked || 'Pop-up blocked. Please allow pop-ups for this site.';
    case 'downloading':
      return strings.downloading || 'Downloading...';
    case 'downloadBtn':
      return strings.downloadBtn || 'Download links';
    case 'downloadResult':
      return (strings.downloadResult || `Downloaded ${args[0]}. ${args[1]} failed.`)
        .replace('{0}', args[0])
        .replace('{1}', args[1]);
    default:
      return '';
  }
}

// Event listeners
inputArea.addEventListener('input', processInput);
inputArea.addEventListener('paste', handlePaste);
btnSelectAll.addEventListener('click', selectAll);
btnClearSelection.addEventListener('click', clearSelection);
btnClear.addEventListener('click', clearAll);
btnDownload.addEventListener('click', downloadLinks);
btnOpen.addEventListener('click', openLinks);

// Initial state
renderLinks();
