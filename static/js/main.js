// متغيرات عامة
let currentResults = [];

/**
 * دالة لتحليل الكمية من النص
 * تدعم الصيغ التالية:
 * - 1d أو 1 = درزن واحد (12 حبة)
 * - 0.5d = نصف درزن (6 حبات)
 * - 2d+5 = درزنان + 5 حبات (29 حبة)
 * - 15 = 15 حبة مباشرة
 */
function parseQuantity(quantityStr) {
    const str = (quantityStr || '').trim();
    if (str === '') return 0;
    const num = parseInt(str, 10);
    return Number.isNaN(num) ? 0 : num;
}

// عناصر DOM
const searchBtn = document.getElementById('search-btn');
const clearBtn = document.getElementById('clear-btn');
const productNumbersTextarea = document.getElementById('product-numbers');
const resultsSection = document.getElementById('results-section');
const recipientNameInput = document.getElementById('recipient-name');
const resultsContainer = document.getElementById('results-container');
const resultsCount = document.getElementById('results-count');
const loadingEl = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const warehouseView = document.getElementById('warehouse-view');
const restoreBtn = document.getElementById('restore-btn');
const autoSaveStatus = document.getElementById('auto-save-status');
const lastSavedInfo = document.getElementById('last-saved-info');
const lastSavedTime = document.getElementById('last-saved-time');

// مفاتيح LocalStorage
const STORAGE_KEY = 'inventory_product_numbers';
const STORAGE_RECIPIENT_KEY = 'inventory_recipient_name';
const STORAGE_TIMESTAMP_KEY = 'inventory_save_timestamp';

// متغير للحفظ التلقائي
let autoSaveTimeout = null;

const selectAllBtn = document.getElementById('select-all-btn');
if (selectAllBtn) {
    selectAllBtn.addEventListener('change', toggleSelectAll);
}

// استمع للأحداث
searchBtn.addEventListener('click', handleSearch);
clearBtn.addEventListener('click', handleClear);
productNumbersTextarea.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        handleSearch();
    }
});

// الحفظ التلقائي أثناء الكتابة
productNumbersTextarea.addEventListener('input', () => {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        autoSaveData();
    }, 1000); // حفظ بعد ثانية من التوقف عن الكتابة
});

// حفظ اسم المستلم أيضاً
if (recipientNameInput) {
    recipientNameInput.addEventListener('input', () => {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            autoSaveData();
        }, 1000);
    });
}

// زر الاستعادة
if (restoreBtn) {
    restoreBtn.addEventListener('click', restoreData);
}

// استعادة البيانات عند تحميل الصفحة
window.addEventListener('DOMContentLoaded', () => {
    checkForSavedData();
});

// معالج البحث
async function handleSearch() {
    // حفظ البيانات قبل البحث (للأمان)
    autoSaveData();
    
    const input = productNumbersTextarea.value.trim();
    const recipientName = recipientNameInput ? recipientNameInput.value.trim() : '';
    
    if (!recipientName) {
        showError('الرجاء إدخال اسم المستلم');
        return;
    }

    if (!input) {
        showError('الرجاء إدخال أرقام المنتجات');
        return;
    }
    
    // تنظيف النتائج السابقة
    hideError();
    showLoading();
    
    try {
        // معالجة الإدخال (دعم الكمية)
        const searchData = parseSearchInput(input);
        
        const response = await fetch('/api/search/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(searchData)
        });
        
        const data = await response.json();
        
        if (data.results) {
            currentResults = data.results;
            displayResults(data.results);
            updateResultsCount(data.results);
            drawWarehouse(data.results);
        } else {
            throw new Error('لم يتم إرجاع نتائج من الخادم');
        }
    } catch (error) {
        showError('حدث خطأ أثناء البحث: ' + error.message);
        hideResults();
    } finally {
        hideLoading();
    }
}

// معالجة الإدخال لفصل الأرقام والكميات
function parseSearchInput(input) {
    const lines = input.split('\n').filter(line => line.trim());
    const products = [];
    const seenNumbers = new Set();
    const duplicates = [];
    const invalidQtyLines = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let productNumber = trimmed;
        let quantity = 0;

        const lastColon = trimmed.lastIndexOf(':');
        if (lastColon > 0) {
            productNumber = trimmed.slice(0, lastColon).trim();
            const quantityStr = trimmed.slice(lastColon + 1).trim();
            const parsed = parseQuantity(quantityStr);
            if (Number.isNaN(parsed)) {
                invalidQtyLines.push(trimmed);
            } else {
                quantity = parsed;
            }
        }

        if (!productNumber) continue;

        if (seenNumbers.has(productNumber)) {
            duplicates.push(productNumber);
            continue;
        }
        seenNumbers.add(productNumber);
        products.push({ product_number: productNumber, quantity });
    }

    if (duplicates.length > 0) {
        const uniqueDuplicates = [...new Set(duplicates)];
        alert(`⚠️ يوجد أرقام منتج مكررة:\n${uniqueDuplicates.join('\n')}`);
        showWarning(uniqueDuplicates);
    }

    if (invalidQtyLines.length > 0) {
        alert(`❌ تم تجاهل الكمية غير الصحيحة وسيتم اعتبارها 0:\n${invalidQtyLines.join('\n')}`);
    }

    return { products };
}

// إظهار تحذير في الواجهة (مُوحَّد)
function showWarning(duplicates) {
    const errorMessage = document.getElementById('error-message');
    if (!errorMessage) return;
    errorMessage.innerHTML = `<strong>⚠️ أرقام مكررة:</strong><br>${duplicates.map(num => `<code>${num}</code>`).join(', ')}<br><small>تم تجاهلها - سيظهر كل منتج مرة واحدة</small>`;
    errorMessage.className = 'alert alert-warning';
    errorMessage.style.display = 'block';
    setTimeout(() => {
        if (errorMessage.className.includes('alert-warning')) {
            errorMessage.style.display = 'none';
            errorMessage.textContent = '';
        }
    }, 5000);
}

// عرض النتائج
function displayResults(results) {
    // إعادة تعيين خانة تحديد الكل
    const selectAllBtn = document.getElementById('select-all-btn');
    if (selectAllBtn) {
        selectAllBtn.checked = false;
    }
    
    // إعادة تعيين المنتجات المحددة
    selectedProducts = [];
    updateConfirmButton();

    resultsContainer.innerHTML = '';
    
    if (results.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">لم يتم العثور على منتجات</p>';
        return;
    }
    
    // تطبيق Grid Layout
    resultsContainer.style.display = 'grid';
    resultsContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
    resultsContainer.style.gap = '10px';
    
    results.forEach((product, index) => {
        const card = createProductCard(product, index);
        resultsContainer.appendChild(card);
    });
    
    resultsSection.style.display = 'block';
}

// إنشاء بطاقة منتج
function createProductCard(product, index) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    if (!product.found) {
        card.classList.add('not-found');
    }
    
    // إضافة كلاس للكمية غير كافية
    if (product.found && product.requested_quantity && product.quantity < product.requested_quantity) {
        card.classList.add('low-quantity');
        card.style.background = '#fef2f2';
        card.style.borderColor = '#ef4444';
    }
    
    let locationsHtml = '';
    
    // معلومات الكمية
    let quantityInfo = '';
    if (product.found) {
        if (product.requested_quantity) {
            const shortage = product.requested_quantity - product.quantity;
            if (shortage > 0) {
                quantityInfo = `
                    <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #ef4444;">
                        <div style="color: #991b1b; font-weight: bold; margin-bottom: 5px;">⚠️ الكمية غير كافية</div>
                        <div style="color: #991b1b;">
                            المطلوب: <strong>${product.requested_quantity}</strong> | 
                            المتوفر: <strong>${product.quantity}</strong> | 
                            النقص: <strong style="color: #dc2626;">${shortage}</strong>
                        </div>
                    </div>
                `;
            } else {
                quantityInfo = `
                    <div style="background: #dcfce7; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #10b981;">
                        <div style="color: #065f46; font-weight: bold; margin-bottom: 5px;">✓ الكمية متوفرة</div>
                        <div style="color: #047857;">
                            المطلوب: <strong>${product.requested_quantity}</strong> | 
                            المتوفر: <strong>${product.quantity}</strong>
                        </div>
                    </div>
                `;
            }
        }
    }
    
    let suggestionsHtml = '';
    if (!product.found && product.suggestions && product.suggestions.length > 0) {
        const csv = product.suggestions.map(s => s.product_number).join(',');
        suggestionsHtml = '<div class="suggestions">'
            + `<div style="display:flex; align-items:center; justify-content:space-between;">
                <h4>🔎 اقتراحات مشابهة:</h4>
                <button onclick="useAllSuggestions('${product.product_number}', '${csv}', ${product.requested_quantity || 0})" style="background:#334155; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:0.85rem;">استخدام الكل</button>
              </div>`
            + '<ul style="list-style: none; padding: 0; margin: 8px 0;">';
        product.suggestions.forEach(s => {
            const numHtml = highlightMatch(s.product_number, product.product_number);
            const nameHtml = s.name ? highlightMatch(s.name, product.product_number) : '';
            suggestionsHtml += `<li style="padding: 6px 8px; margin: 4px 0; background: #f8fafc; border-right: 3px solid #667eea; border-radius: 6px; color: #334155; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                <div>
                    <strong>${numHtml}</strong> ${nameHtml ? `- ${nameHtml}` : ''}
                    <span style="color:#64748b; font-size: 0.85rem;"> | الكمية: ${s.quantity}</span>
                </div>
                <button onclick="useSuggestion('${product.product_number}', '${s.product_number}', ${product.requested_quantity || 0})" style="background:#667eea; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:0.85rem;">استخدام</button>
            </li>`;
        });
        suggestionsHtml += '</ul></div>';
    }

    const hasLocation = product.found && product.locations && product.locations.length > 0;
    const firstLocation = hasLocation ? product.locations[0] : null;
    const findOnMapBtn = hasLocation ? `
        <button 
            class="btn btn-primary" 
            style="margin-right: 8px;"
            onclick="ensureGridAndHighlight(${firstLocation.row}, ${firstLocation.column})">
            عرض على الخريطة 🔍
        </button>
    ` : '';

    if (product.found) {
        if (hasLocation) {
            const locText = `R${firstLocation.row}C${firstLocation.column}`;
            locationsHtml = `
                <div style="background:#ecfeff; padding:12px; border-radius:8px; margin:10px 0; border-right:4px solid #1d4ed8;">
                    <div style="color:#0f172a; font-weight:600; margin-bottom:6px;">الأماكن:</div>
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <span style="background:#e0e7ff; color:#1e40af; padding:4px 8px; border-radius:6px; font-weight:700;">${locText}</span>
                        ${findOnMapBtn}
                    </div>
                </div>
            `;
        } else {
            locationsHtml = `
                <div style="color:#ef4444; font-weight:600; margin-top:8px;">
                    لا يوجد مواقع مسجلة لهذا المنتج
                </div>
            `;
        }
    }

    card.innerHTML = `
        <div class="product-header">
            <div class="product-info" style="display: flex; align-items: center; gap: 10px; flex: 1;">
                ${product.found ? `
                    <input type="checkbox" id="product-${index}" 
                           onchange="handleProductCheck(${index}, '${product.product_number}', ${product.quantity}, ${product.requested_quantity || 0})"
                           style="width: 18px; height: 18px; cursor: pointer;">
                ` : ''}
                <div style="flex: 1;">
                    <h3 style="margin: 0; font-size: 1rem;">
                        <span class="product-number">${product.product_number}</span>
                        ${product.name ? `<span class="product-name"> - ${product.name}</span>` : ''}
                    </h3>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="status ${product.found ? 'found' : 'not-found'}" style="font-size: 0.85rem;">
                    ${product.found ? '✓ موجود' : '✗ غير موجود'}
                </span>
            </div>
        </div>
        ${quantityInfo}
        ${locationsHtml}
        ${!product.found ? `<p style="color: var(--error-color); margin-top: 10px; font-size: 0.85rem;">${product.error || 'لم يتم العثور على هذا المنتج'}</p>` : ''}
        ${!product.found ? suggestionsHtml : ''}
    `;
    
    // إضافة تأثير الظهور
    setTimeout(() => {
        card.style.opacity = '1';
    }, index * 50);
    
    return card;
}

// ضمان رسم الخريطة أولاً ثم إبراز الموقع المطلوب
function ensureGridAndHighlight(row, column) {
    const gridContainer = document.getElementById('warehouse-grid');
    if (!gridContainer || gridContainer.children.length === 0) {
        try {
            drawWarehouse(currentResults);
        } catch (e) {}
        setTimeout(() => highlightLocation(row, column), 200);
    } else {
        highlightLocation(row, column);
    }
}

function useSuggestion(originalNumber, suggestedNumber, requestedQty) {
    const current = productNumbersTextarea.value || '';
    let lines = current.trim() ? current.split('\n') : [];
    const hasSuggested = lines.some(line => (line.trim().split(':')[0]) === suggestedNumber);
    let replaced = false;
    lines = lines.map(line => {
        const parts = line.trim().split(':');
        const num = (parts[0] || '').trim();
        if (num === originalNumber) {
            replaced = true;
            if (hasSuggested) {
                return null;
            }
            if (requestedQty && Number(requestedQty) > 0) {
                return `${suggestedNumber}:${requestedQty}`;
            }
            return `${suggestedNumber}`;
        }
        return line;
    }).filter(Boolean);
    if (!replaced && !hasSuggested) {
        if (requestedQty && Number(requestedQty) > 0) {
            lines.push(`${suggestedNumber}:${requestedQty}`);
        } else {
            lines.push(`${suggestedNumber}`);
        }
    }
    productNumbersTextarea.value = lines.join('\n');
    autoSaveData();
    handleSearch();
}

function useAllSuggestions(originalNumber, csvNumbers, requestedQty) {
    const list = (csvNumbers || '').split(',').map(s => s.trim()).filter(Boolean);
    const current = productNumbersTextarea.value || '';
    let lines = current.trim() ? current.split('\n') : [];
    let replaced = false;
    lines = lines.map(line => {
        const parts = line.trim().split(':');
        const num = (parts[0] || '').trim();
        if (num === originalNumber) {
            replaced = true;
            const first = list[0];
            if (!first) return null;
            const already = lines.some(l => (l.trim().split(':')[0]) === first);
            if (already) return null;
            if (requestedQty && Number(requestedQty) > 0) {
                return `${first}:${requestedQty}`;
            }
            return `${first}`;
        }
        return line;
    }).filter(Boolean);
    for (let i = 1; i < list.length; i++) {
        const num = list[i];
        const exists = lines.some(l => (l.trim().split(':')[0]) === num);
        if (!exists) {
            if (requestedQty && Number(requestedQty) > 0) {
                lines.push(`${num}:${requestedQty}`);
            } else {
                lines.push(`${num}`);
            }
        }
    }
    if (!replaced && list.length > 0) {
        const first = list[0];
        const exists = lines.some(l => (l.trim().split(':')[0]) === first);
        if (!exists) {
            if (requestedQty && Number(requestedQty) > 0) {
                lines.push(`${first}:${requestedQty}`);
            } else {
                lines.push(`${first}`);
            }
        }
    }
    productNumbersTextarea.value = lines.join('\n');
    autoSaveData();
    handleSearch();
}

function highlightMatch(text, query) {
    const t = String(text || '');
    const q = String(query || '');
    if (!t || !q) return t;
    const idx = t.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return t;
    const before = t.slice(0, idx);
    const mid = t.slice(idx, idx + q.length);
    const after = t.slice(idx + q.length);
    return `${before}<mark style="background:#fde68a; color:#111827;">${mid}</mark>${after}`;
}

// تحديث عدد النتائج
function updateResultsCount(results) {
    const foundCount = results.filter(r => r.found).length;
    const totalCount = results.length;
    
    resultsCount.textContent = `تم العثور على ${foundCount} من أصل ${totalCount}`;
}

// متغيرات التحكم بالمستودع
let zoomLevel = 1;
let showOnlyProducts = false;

// رسم خريطة المستودع - الحصول على البيانات من السيرفر
async function drawWarehouse(results) {
    const foundProducts = results.filter(p => p.found && p.locations && p.locations.length > 0);
    
    if (foundProducts.length === 0) {
        warehouseView.style.display = 'none';
        try { renderLocationsTable(results); } catch (e) {}
        return;
    }
    
    warehouseView.style.display = 'block';
    
    // الحصول على أبعاد المستودع من السيرفر
    let warehouseData;
    try {
        const response = await fetch('/api/grid/');
        warehouseData = await response.json();
    } catch (error) {
        console.error('Error fetching warehouse data:', error);
        warehouseData = { rows: 6, columns: 15 };
    }
    
    const rows = warehouseData.rows || 6;
    const columns = warehouseData.columns || 15;
    const grid = warehouseData.grid || {};
    
    // التحقق من حجم الشاشة
    const isMobile = window.innerWidth <= 768;
    const isVerySmall = window.innerWidth <= 480;
    
    // تحديد أحجام الخلايا بناءً على حجم الشاشة - دقة عالية
    let cellSize, headerCellWidth, headerCellHeight, fontSize, locationFontSize, productFontSize;
    
    if (isVerySmall) {
        cellSize = '40px';
        headerCellWidth = '40px';
        headerCellHeight = '40px';
        fontSize = '0.7rem';
        locationFontSize = '0.45rem';
        productFontSize = '0.5rem';
    } else if (isMobile) {
        cellSize = '45px';
        headerCellWidth = '45px';
        headerCellHeight = '45px';
        fontSize = '0.75rem';
        locationFontSize = '0.5rem';
        productFontSize = '0.55rem';
    } else {
        cellSize = '50px';
        headerCellWidth = '50px';
        headerCellHeight = '50px';
        fontSize = '0.8rem';
        locationFontSize = '0.5rem';
        productFontSize = '0.65rem';
    }
    
    // إنشاء شبكة HTML
    const gridContainer = document.getElementById('warehouse-grid');
    gridContainer.innerHTML = '';
    // CSS مسؤول عن العرض - لا نحتاج to inline styles
    
    // إنشاء رأس الأعمدة
    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.gap = '0';
    headerRow.classList.add('grid-row');
    
    const cornerCell = document.createElement('div');
    cornerCell.style.cssText = `width: ${headerCellWidth}; height: ${headerCellHeight}; background: #667eea; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 1px solid #5568d3; font-size: ${fontSize}; flex-shrink: 0;`;
    headerRow.appendChild(cornerCell);
    
    for (let col = 1; col <= columns; col++) {
        const headerCell = document.createElement('div');
        headerCell.style.cssText = `width: ${cellSize}; height: ${headerCellHeight}; background: #667eea; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 1px solid #5568d3; font-size: ${fontSize}; flex-shrink: 0;`;
        headerCell.textContent = col;
        headerCell.classList.add('grid-header-cell');
        headerCell.classList.add('grid-column-header');
        headerCell.setAttribute('data-column', col);
        headerRow.appendChild(headerCell);
    }
    
    gridContainer.appendChild(headerRow);
    
    // إنشاء الصفوف
    for (let row = 1; row <= rows; row++) {
        const rowDiv = document.createElement('div');
        rowDiv.style.display = 'flex';
        rowDiv.style.gap = '0';
        rowDiv.classList.add('grid-row');
        
        // رأس الصف
        const rowHeader = document.createElement('div');
        rowHeader.style.cssText = `width: ${headerCellWidth}; height: ${cellSize}; background: #667eea; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 1px solid #5568d3; font-size: ${fontSize}; flex-shrink: 0;`;
        rowHeader.textContent = row;
        rowHeader.classList.add('grid-row-header');
        rowHeader.setAttribute('data-row', row);
        rowDiv.appendChild(rowHeader);
        
        // الخلايا
        for (let col = 1; col <= columns; col++) {
            const cell = document.createElement('div');
            const key = `${row},${col}`;
            const cellData = grid[key] || {};
            const hasProduct = foundProducts.some(p => 
                p.locations && p.locations.some(loc => loc.row === row && loc.column === col)
            );
            
            // جعل جميع الخلايا بنفس الحجم والتصميم لمنع التداخل - دقة عالية
            cell.style.cssText = `width: ${cellSize}; height: ${cellSize}; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px solid #e2e8f0; flex-shrink: 0; position: relative; overflow: hidden;`;
            cell.classList.add('warehouse-grid-cell');
            
            // إضافة data attributes للتعرف الدقيق على الخلية
            cell.setAttribute('data-row', row);
            cell.setAttribute('data-column', col);
            
            const locationText = `R${row}C${col}`;
            
            if (hasProduct) {
                // خلية تحتوي على منتج
                cell.classList.add('has-product');
                cell.style.background = '#ef4444';
                cell.style.border = '3px solid #dc2626';
                cell.style.color = 'white';
                cell.style.fontWeight = 'bold';
                cell.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.3)';
                
                const product = foundProducts.find(p => 
                    p.locations && p.locations.some(loc => loc.row === row && loc.column === col)
                );
                const location = product.locations.find(loc => loc.row === row && loc.column === col);
                
                // عرض رقم المنتج كامل بتصميم أفضل
                let displayProductText = product.product_number;
                
                // استخدام الأنماط الداخلية للتصميم - تحسين التنسيق
                cell.innerHTML = `
                    <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; width: 100%; padding: 2px; box-sizing: border-box;">
                        <div style="font-size: ${locationFontSize}; color: rgba(255,255,255,0.7); font-weight: bold; line-height: 1.1; margin-bottom: 2px;">${locationText}</div>
                        <div style="font-size: ${productFontSize}; color: white; font-weight: bold; word-break: break-all; overflow-wrap: break-word; max-width: 100%;">${displayProductText}</div>
                    </div>
                `;
                cell.title = `الموقع: R${row}C${col}\nالمنتج: ${product.product_number}\nالكمية: ${product.quantity}`;
                
                // إضافة event listener لعرض تفاصيل المنتج
                cell.addEventListener('click', function() {
                    showProductDetails(product, row, col);
                });
                
                // إضافة cursor pointer للإشارة إلى أنه يمكن النقر
                cell.style.cursor = 'pointer';
            } else {
                // خلية فارغة
                cell.style.background = '#f1f5f9';
                cell.style.color = '#64748b';
                cell.innerHTML = `
                    <div style="display: flex; justify-content: center; align-items: center; height: 100%; width: 100%; padding: 2px; box-sizing: border-box;">
                        <div style="font-size: ${locationFontSize}; font-weight: bold; text-align: center; color: #64748b;">${locationText}</div>
                    </div>
                `;
                cell.title = `الموقع: R${row}C${col}\nموقع فارغ`;
            }
            
            rowDiv.appendChild(cell);
        }
        
        gridContainer.appendChild(rowDiv);
    }
}

// تم حذف دوال العرض البسيط - الآن نعرض الشبكة دائماً على جميع الأحجام بدقة عالية


// تمييز موقع معين - استخدام data attributes للدقة الكاملة
function highlightLocation(row, column) {
    console.log('Highlighting location:', `R${row}C${column}`);
    const gridContainer = document.getElementById('warehouse-grid');
    
    if (!gridContainer) {
        console.error('Grid container not found!');
        alert('يرجى عرض الخريطة أولاً');
        return;
    }
    
    // البحث الدقيق باستخدام data attributes - لا يوجد أي احتمال للخطأ
    const targetCell = gridContainer.querySelector(
        `.warehouse-grid-cell[data-row="${row}"][data-column="${column}"]`
    );
    
    if (!targetCell) {
        console.error('Cell not found for location:', `R${row}C${column}`);
        alert(`لم يتم العثور على الموقع R${row}C${column}`);
        return;
    }
    
    console.log('Found cell:', targetCell);
    
    // البحث عن row header و column header
    const rowHeader = gridContainer.querySelector(`.grid-row-header[data-row="${row}"]`);
    const columnHeader = gridContainer.querySelector(`.grid-column-header[data-column="${column}"]`);
    
    // حفظ الحالة الأصلية للخلية
    const originalBorder = targetCell.style.border;
    const originalBoxShadow = targetCell.style.boxShadow;
    const originalZIndex = targetCell.style.zIndex;
    const originalTransform = targetCell.style.transform;
    
    // حفظ الحالة الأصلية للـ headers
    const originalRowHeaderBg = rowHeader ? rowHeader.style.background : null;
    const originalRowHeaderBorder = rowHeader ? rowHeader.style.border : null;
    const originalColHeaderBg = columnHeader ? columnHeader.style.background : null;
    const originalColHeaderBorder = columnHeader ? columnHeader.style.border : null;
    
    // تطبيق التأثير البرتقالي على الخلية
    targetCell.style.setProperty('border', '6px solid #f97316', 'important');
    targetCell.style.setProperty('box-shadow', '0 0 25px rgba(249, 115, 22, 1)', 'important');
    targetCell.style.setProperty('z-index', '1000', 'important');
    targetCell.style.setProperty('transform', 'scale(1.2)', 'important');
    targetCell.style.setProperty('transition', 'all 0.3s ease', 'important');
    
    // تطبيق التأثير البرتقالي على الـ headers
    if (rowHeader) {
        rowHeader.style.setProperty('background', '#f97316', 'important'); // برتقالي
        rowHeader.style.setProperty('border', '3px solid #ea580c', 'important');
        rowHeader.style.setProperty('transition', 'all 0.3s ease', 'important');
        rowHeader.style.setProperty('box-shadow', '0 0 15px rgba(249, 115, 22, 0.5)', 'important');
    }
    
    if (columnHeader) {
        columnHeader.style.setProperty('background', '#f97316', 'important'); // برتقالي
        columnHeader.style.setProperty('border', '3px solid #ea580c', 'important');
        columnHeader.style.setProperty('transition', 'all 0.3s ease', 'important');
        columnHeader.style.setProperty('box-shadow', '0 0 15px rgba(249, 115, 22, 0.5)', 'important');
    }
    
    console.log('Applied highlight effect to cell and headers at R' + row + 'C' + column);
    
    // إعادة الحالة الأصلية بعد 3 ثواني
    setTimeout(() => {
        const bgColor = targetCell.style.background;
        
        // إعادة الخلية - إزالة !important
        targetCell.style.removeProperty('border');
        targetCell.style.removeProperty('box-shadow');
        targetCell.style.removeProperty('z-index');
        targetCell.style.removeProperty('transform');
        targetCell.style.removeProperty('transition');
        
        // إعادة القيم الأصلية
        if (bgColor && (bgColor.includes('#ef4444') || bgColor.includes('239, 68, 68'))) {
            targetCell.style.border = '3px solid #dc2626';
        } else {
            targetCell.style.border = '2px solid #e2e8f0';
        }
        
        targetCell.style.boxShadow = originalBoxShadow || 'none';
        targetCell.style.zIndex = originalZIndex || '1';
        targetCell.style.transform = originalTransform || 'scale(1)';
        
        // إعادة الـ headers
        if (rowHeader) {
            rowHeader.style.removeProperty('background');
            rowHeader.style.removeProperty('border');
            rowHeader.style.removeProperty('box-shadow');
            rowHeader.style.removeProperty('transition');
            
            rowHeader.style.background = originalRowHeaderBg || '#667eea';
            rowHeader.style.border = originalRowHeaderBorder || '1px solid #5568d3';
        }
        
        if (columnHeader) {
            columnHeader.style.removeProperty('background');
            columnHeader.style.removeProperty('border');
            columnHeader.style.removeProperty('box-shadow');
            columnHeader.style.removeProperty('transition');
            
            columnHeader.style.background = originalColHeaderBg || '#667eea';
            columnHeader.style.border = originalColHeaderBorder || '1px solid #5568d3';
        }
        
        console.log('Removed highlight effect');
    }, 3000);
    
    // التمرير للموقع
    setTimeout(() => {
        targetCell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 100);
}

// معالج المسح
function handleClear() {
    productNumbersTextarea.value = '';
    hideResults();
    hideError();
}

// تبديل تحديد الكل
function toggleSelectAll() {
    const selectAllBtn = document.getElementById('select-all-btn');
    if (!selectAllBtn) return;
    
    const isChecked = selectAllBtn.checked;
    
    // في حالة إلغاء التحديد، قم بإلغاء كل شيء مباشرة
    if (!isChecked) {
        currentResults.forEach((product, index) => {
            const checkbox = document.getElementById(`product-${index}`);
            if (checkbox && checkbox.checked) {
                checkbox.checked = false;
                selectedProducts = selectedProducts.filter(p => p.number !== product.product_number);
            }
        });
        updateConfirmButton();
        return;
    }

    // قوائم للمنتجات التي بها مشاكل
    let notFoundProducts = [];
    let outOfStockProducts = [];
    
    // فحص جميع المنتجات أولاً
    currentResults.forEach((product) => {
        if (!product.found) {
            notFoundProducts.push(product.product_number);
        } else if (!product.quantity || product.quantity <= 0) {
            outOfStockProducts.push(product.product_number);
        }
    });
    
    // إذا وجد أي خطأ، امنع التحديد كلياً واعرض رسالة
    if (notFoundProducts.length > 0 || outOfStockProducts.length > 0) {
        // إلغاء تحديد خانة "تحديد الكل"
        selectAllBtn.checked = false;
        
        let message = '⚠️ لا يمكن تحديد الكل لوجود مشاكل في بعض المنتجات:\n\n';
        
        if (outOfStockProducts.length > 0) {
            message += '❌ المنتجات التالية غير متوفرة (الكمية 0):\n';
            message += outOfStockProducts.join(', ') + '\n\n';
        }
        
        if (notFoundProducts.length > 0) {
            message += '🔍 المنتجات التالية غير موجودة في النظام:\n';
            message += notFoundProducts.join(', ') + '\n';
        }
        
        message += '\nالرجاء معالجة هذه المنتجات أو تحديد المنتجات الصالحة يدوياً.';
        alert(message);
        return;
    }
    
    // إذا كانت جميع المنتجات سليمة، قم بتحديدها
    currentResults.forEach((product, index) => {
        const checkbox = document.getElementById(`product-${index}`);
        if (!checkbox) return;
        
        if (!checkbox.checked) {
            checkbox.checked = true;
            if (!selectedProducts.find(p => p.number === product.product_number)) {
                selectedProducts.push({
                    number: product.product_number,
                    quantity: product.requested_quantity || 0,
                    index: index
                });
            }
        }
    });
    
    updateConfirmButton();
}

// معالجة تحديد المنتجات
let selectedProducts = [];

function handleProductCheck(index, productNumber, availableQuantity, requestedQuantity) {
    const checkbox = document.getElementById(`product-${index}`);
    const isChecked = checkbox.checked;
    
    if (isChecked) {
        // إضافة المنتج للمحددة
        if (!selectedProducts.find(p => p.number === productNumber)) {
            selectedProducts.push({
                number: productNumber,
                quantity: requestedQuantity || 0,
                index: index
            });
        }
    } else {
        // إزالة المنتج من المحددة
        selectedProducts = selectedProducts.filter(p => p.number !== productNumber);
    }
    
    // مزامنة حالة زر تحديد الكل
    const selectAllBtn = document.getElementById('select-all-btn');
    if (selectAllBtn) {
        if (!isChecked) {
             selectAllBtn.checked = false;
        } else {
            // التحقق مما إذا تم تحديد جميع المنتجات الصالحة
            const allValidSelected = currentResults.every((p, idx) => {
                if (!p.found || p.quantity <= 0) return true; // تجاهل غير الصالحة
                const cb = document.getElementById(`product-${idx}`);
                return cb && cb.checked;
            });
            // يجب أن يكون هناك على الأقل منتج واحد صالح ومحدد لتفعيل تحديد الكل
            const hasValidProducts = currentResults.some(p => p.found && p.quantity > 0);
            if (allValidSelected && hasValidProducts) {
                selectAllBtn.checked = true;
            }
        }
    }
    
    updateConfirmButton();
}

// تحديث زر التأكيد
function updateConfirmButton() {
    let existingBtn = document.getElementById('confirm-selected-btn');
    
    if (selectedProducts.length > 0 && !existingBtn) {
        const btn = document.createElement('button');
        btn.id = 'confirm-selected-btn';
        btn.className = 'btn btn-primary';
        btn.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 1000; padding: 15px 30px; font-size: 1.1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.3);';
        btn.innerHTML = `✓ تأكيد أخذ المنتجات (${selectedProducts.length})`;
        btn.onclick = confirmSelectedProducts;
        document.body.appendChild(btn);
    } else if (existingBtn) {
        if (selectedProducts.length > 0) {
            existingBtn.innerHTML = `✓ تأكيد أخذ المنتجات (${selectedProducts.length})`;
            existingBtn.style.display = 'block';
        } else {
            existingBtn.style.display = 'none';
        }
    }
    
    if (selectedProducts.length === 0 && existingBtn) {
        existingBtn.remove();
    }
}

// تأكيد أخذ المنتجات
async function confirmSelectedProducts() {
    if (selectedProducts.length === 0) {
        alert('لم يتم تحديد أي منتج');
        return;
    }

    const recipientName = recipientNameInput ? recipientNameInput.value.trim() : '';
    if (!recipientName) {
        alert('الرجاء إدخال اسم المستلم قبل التأكيد');
        return;
    }
    
    // التحقق من أن جميع المنتجات التي لها كميات مطلوبة قد تم تحديدها
    const productsWithRequestedQty = currentResults.filter(p => 
        p.found && p.requested_quantity && p.requested_quantity > 0
    );
    
    if (productsWithRequestedQty.length > 0) {
        const selectedNumbers = selectedProducts.map(p => p.number);
        const missingProducts = productsWithRequestedQty.filter(p => 
            !selectedNumbers.includes(p.product_number)
        );
        
        if (missingProducts.length > 0) {
            const missingNumbers = missingProducts.map(p => p.product_number).join(', ');
            alert(`⚠️ يجب تحديد جميع المنتجات التي لها كميات مطلوبة!\n\nالمنتجات غير المحددة:\n${missingNumbers}\n\nالمنتجات غير المحددة سيتم تجاهلها ولن تتغير كميتها.`);
            
            // سؤال للمستخدم إذا كان يريد المتابعة
            if (!confirm('هل تريد المتابعة مع المنتجات المحددة فقط؟\nالمنتجات غير المحددة ستبقى كميتها كما هي.')) {
                return;
            }
        }
    }
    
    // التحقق النهائي
    if (!confirm(`هل تريد تأكيد أخذ ${selectedProducts.length} منتج؟\n\nالمنتجات المحددة: ${selectedProducts.map(p => p.number).join(', ')}`)) {
        return;
    }
    
    try {
        // التحقق من حالة الاتصال
        if (typeof offlineManager !== 'undefined' && !offlineManager.isOnline) {
            await offlineManager.queueOrder({ 
                products: selectedProducts, 
                recipient_name: recipientName 
            });
            
            // إزالة المنتجات المأخوذة (محاكاة النجاح)
            selectedProducts.forEach(product => {
                const checkbox = document.getElementById(`product-${product.index}`);
                if (checkbox) checkbox.checked = false;
            });
            selectedProducts = [];
            updateConfirmButton();
            return;
        }

        const response = await fetch('/api/confirm-products/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': (typeof offlineManager !== 'undefined') ? offlineManager.getCsrfToken() : ''
            },
            body: JSON.stringify({ products: selectedProducts, recipient_name: recipientName })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // إظهار إشعار بالنجاح وحفظ الطلبية
            if (data.order_number) {
                alert('✓ تم خصم الكميات بنجاح\n📋 تم حفظ الطلبية في السجل\nرقم الطلبية: ' + data.order_number);
            } else {
                alert('✓ تم خصم الكميات بنجاح');
            }
            
            // إزالة المنتجات المأخوذة
            selectedProducts.forEach(product => {
                const checkbox = document.getElementById(`product-${product.index}`);
                if (checkbox) checkbox.checked = false;
            });
            selectedProducts = [];
            updateConfirmButton();
            // إعادة البحث لتحديث الكميات
            handleSearch();
        } else {
            alert('✗ خطأ: ' + (data.error || 'حدث خطأ'));
        }
    } catch (error) {
        console.error('Confirmation error:', error);
        
        // في حالة خطأ الشبكة، نعرض خيار الحفظ المحلي
        if (typeof offlineManager !== 'undefined') {
            const confirmed = confirm('تعذر الاتصال بالخادم. هل تريد حفظ الطلب محلياً ليتم إرساله عند عودة الاتصال؟');
            if (confirmed) {
                await offlineManager.queueOrder({ 
                    products: selectedProducts, 
                    recipient_name: recipientName 
                });
                
                selectedProducts.forEach(product => {
                    const checkbox = document.getElementById(`product-${product.index}`);
                    if (checkbox) checkbox.checked = false;
                });
                selectedProducts = [];
                updateConfirmButton();
                return;
            }
        }
        
        alert('✗ خطأ: ' + error.message);
    }
}

// إخفاء/إظهار العناصر
function showLoading() {
    loadingEl.style.display = 'block';
    searchBtn.disabled = true;
}

function hideLoading() {
    loadingEl.style.display = 'none';
    searchBtn.disabled = false;
}

function hideResults() {
    resultsSection.style.display = 'none';
    warehouseView.style.display = 'none';
    resultsContainer.innerHTML = '';
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.className = 'alert alert-error';
    errorMessage.style.display = 'block';
}

function hideError() {
    errorMessage.style.display = 'none';
    errorMessage.textContent = '';
}

 

// Export to PDF - New improved version with page splitting
async function exportToPDF() {
    const results = currentResults;
    
    if (!results || results.length === 0) {
        alert('No results to export');
        return;
    }
    
    // Get warehouse information
    let warehouseData;
    try {
        const response = await fetch('/api/grid/');
        warehouseData = await response.json();
    } catch (error) {
        warehouseData = { rows: 6, columns: 15 };
    }
    
    const { jsPDF } = window.jspdf;
    const rows = warehouseData.rows || 6;
    const columns = warehouseData.columns || 15;
    
    // Filter only products with locations
    const foundProducts = results.filter(p => p.found && p.locations && p.locations.length > 0);
    
    if (foundProducts.length === 0) {
        alert('No products with locations to export');
        return;
    }
    
    // Create location map
    const locationMap = new Map();
    foundProducts.forEach(product => {
        if (product.locations && product.locations.length > 0) {
            product.locations.forEach(loc => {
                const key = `${loc.row},${loc.column}`;
                if (!locationMap.has(key)) {
                    locationMap.set(key, []);
                }
                locationMap.get(key).push({
                    number: product.product_number,
                    quantity: product.quantity || 0
                });
            });
        }
    });
    
    // Calculate rows per page - increased to reduce pages
    const rowsPerPage = rows <= 6 ? 6 : (rows <= 12 ? 10 : 12);
    const totalPages = Math.ceil(rows / rowsPerPage);
    
    // PDF settings - Landscape orientation
    const pageWidth = 297; // A4 landscape width in mm
    const pageHeight = 210; // A4 landscape height in mm
    const margin = 10; // Reduced margin
    const availableWidth = pageWidth - (2 * margin);
    const availableHeight = pageHeight - (2 * margin);
    
    // Calculate cell dimensions - smaller cells
    const headerHeight = 8; // Smaller header
    const cellWidth = (availableWidth - headerHeight) / columns;
    const cellHeight = (availableHeight - headerHeight - 8) / rowsPerPage; // 8mm for title (reduced)
    
    // Generate all pages in a single document
    const mainDoc = new jsPDF('l', 'mm', 'a4');
    
    for (let page = 0; page < totalPages; page++) {
        if (page > 0) {
            mainDoc.addPage('l'); // Add new page in landscape
        }
        
        const startRow = (page * rowsPerPage) + 1;
        const endRow = Math.min((page + 1) * rowsPerPage, rows);
            
        // Title - smaller
        mainDoc.setFontSize(12);
        mainDoc.setFont('helvetica', 'bold');
        mainDoc.text('Warehouse Locations Map', pageWidth / 2, margin + 5, { align: 'center' });
        
        // Page info - smaller
        mainDoc.setFontSize(8);
        mainDoc.setFont('helvetica', 'normal');
        mainDoc.text(`Page ${page + 1} of ${totalPages}`, pageWidth - margin, margin + 5, { align: 'right' });
        mainDoc.text(`Rows ${startRow}-${endRow}`, margin, margin + 5, { align: 'left' });
        
        // Starting position
        const startY = margin + 10;
        const startX = margin;
        
        // Draw column headers - RTL order (columns start from right)
        mainDoc.setFontSize(8);
        mainDoc.setFont('helvetica', 'bold');
        mainDoc.setFillColor(100, 100, 200);
        mainDoc.rect(startX, startY, headerHeight, headerHeight, 'F');
        mainDoc.setTextColor(255, 255, 255);
        mainDoc.text('R\\C', startX + headerHeight / 2, startY + headerHeight / 2 + 2, { align: 'center' });
        
        // RTL: Draw columns from right to left (column 15 on right, column 1 on left)
        for (let col = 1; col <= columns; col++) {
            // Calculate x position from right (RTL)
            const rtlColIndex = columns - col; // Reverse order
            const x = startX + headerHeight + (rtlColIndex * cellWidth);
            mainDoc.setFillColor(100, 100, 200);
            mainDoc.rect(x, startY, cellWidth, headerHeight, 'F');
            mainDoc.setTextColor(255, 255, 255);
            mainDoc.setFontSize(8);
            mainDoc.text(col.toString(), x + cellWidth / 2, startY + headerHeight / 2 + 2, { align: 'center' });
        }
        
        // Draw rows
        let currentRowNum = 0;
        for (let row = startRow; row <= endRow; row++) {
            const y = startY + headerHeight + (currentRowNum * cellHeight);
            
            // Row header
            mainDoc.setFillColor(100, 100, 200);
            mainDoc.rect(startX, y, headerHeight, cellHeight, 'F');
            mainDoc.setTextColor(255, 255, 255);
            mainDoc.setFontSize(7);
            mainDoc.setFont('helvetica', 'bold');
            mainDoc.text(row.toString(), startX + headerHeight / 2, y + cellHeight / 2 + 2, { align: 'center' });

            // Cells - RTL order (columns from right to left)
            for (let col = 1; col <= columns; col++) {
                // RTL: Calculate x position from right
                const rtlColIndex = columns - col;
                const x = startX + headerHeight + (rtlColIndex * cellWidth);
                const key = `${row},${col}`;
                const hasProduct = locationMap.has(key);
                
                // Cell border - thinner
                mainDoc.setDrawColor(200, 200, 200);
                mainDoc.setLineWidth(0.1);
                
                if (hasProduct) {
                    // Cell with product - Green background
                    mainDoc.setFillColor(76, 175, 80); // Green
                    mainDoc.rect(x, y, cellWidth, cellHeight, 'FD');
                    
                    // Location label - smaller font
                    mainDoc.setTextColor(255, 255, 255);
                    mainDoc.setFontSize(5);
                    mainDoc.setFont('helvetica', 'bold');
                    const locationText = `R${row}C${col}`;
                    mainDoc.text(locationText, x + cellWidth / 2, y + 3, { align: 'center' });
                    
                    // Product numbers (if space allows) - smaller
                    const products = locationMap.get(key);
                    if (products && products.length > 0 && products.length <= 2) {
                        mainDoc.setFontSize(4.5);
                        mainDoc.setFont('helvetica', 'normal');
                        products.forEach((prod, idx) => {
                            const textY = y + 6 + (idx * 3);
                            if (textY < y + cellHeight - 1) {
                                const productText = prod.number.length > 7 ? prod.number.substring(0, 7) : prod.number;
                                mainDoc.text(productText, x + cellWidth / 2, textY, { align: 'center' });
                            }
                        });
                    } else if (products && products.length > 2) {
                        mainDoc.setFontSize(4.5);
                        mainDoc.text(`${products.length}`, x + cellWidth / 2, y + 6, { align: 'center' });
    }
                } else {
                    // Empty cell - Light gray
                    mainDoc.setFillColor(245, 245, 245);
                    mainDoc.rect(x, y, cellWidth, cellHeight, 'FD');
                    
                    // Location label - smaller
                    mainDoc.setTextColor(150, 150, 150);
                    mainDoc.setFontSize(5);
                    mainDoc.setFont('helvetica', 'normal');
                    const locationText = `R${row}C${col}`;
                    mainDoc.text(locationText, x + cellWidth / 2, y + cellHeight / 2 + 1, { align: 'center' });
                }
            }
            
            currentRowNum++;
        }
        
        // Legend (only on first page) - smaller
        if (page === 0) {
            const legendY = startY + headerHeight + (rowsPerPage * cellHeight) + 3;
            mainDoc.setFontSize(7);
            mainDoc.setFont('helvetica', 'bold');
            mainDoc.setTextColor(0, 0, 0);
            mainDoc.text('Legend:', margin, legendY);
            
            // Green box (has products) - smaller
            mainDoc.setFillColor(76, 175, 80);
            mainDoc.rect(margin + 20, legendY - 3, 4, 4, 'F');
            mainDoc.setFont('helvetica', 'normal');
            mainDoc.setFontSize(6);
            mainDoc.text('Has Products', margin + 26, legendY);
            
            // Gray box (empty) - smaller
            mainDoc.setFillColor(245, 245, 245);
            mainDoc.setDrawColor(200, 200, 200);
            mainDoc.rect(margin + 65, legendY - 3, 4, 4, 'FD');
            mainDoc.text('Empty', margin + 71, legendY);
            
            // Summary - smaller
            const totalLocations = locationMap.size;
            const totalProducts = foundProducts.length;
            mainDoc.setFontSize(6);
            mainDoc.text(`Used: ${totalLocations} | Products: ${totalProducts}`, pageWidth - margin, legendY, { align: 'right' });
        }
    }
    
    // Save the PDF
    const filename = `Warehouse_Map_${new Date().toISOString().split('T')[0]}.pdf`;
    mainDoc.save(filename);
    alert(`PDF exported successfully! (${totalPages} page${totalPages > 1 ? 's' : ''})`);
}

// طباعة مواقع المنتجات
function printLocations() {
    const results = currentResults;
    
    if (!results || results.length === 0) {
        alert('لا توجد نتائج للطباعة');
        return;
    }
    
    // إنشاء نافذة طباعة جديدة
    const printWindow = window.open('', '_blank');
    
    const today = new Date().toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // تجميع المواقع
    const locationMap = new Map();
    
    results.forEach(product => {
        if (product.found && product.locations && product.locations.length > 0) {
            product.locations.forEach(loc => {
                const key = `R${loc.row}C${loc.column}`;
                if (!locationMap.has(key)) {
                    locationMap.set(key, []);
                }
                locationMap.get(key).push({
                    product_number: product.product_number,
                    quantity: product.quantity
                });
            });
        }
    });
    
    // ترتيب المواقع
    const sortedLocations = Array.from(locationMap.entries()).sort((a, b) => {
        const [rowA, colA] = a[0].replace('R', '').replace('C', ',').split(',');
        const [rowB, colB] = b[0].replace('R', '').replace('C', ',').split(',');
        if (rowA !== rowB) return rowA - rowB;
        return colA - colB;
    });
    
    // بناء محتوى HTML
    let htmlContent = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>طباعة مواقع المنتجات</title>
            <style>
                @page { margin: 2cm; }
                body {
                    font-family: Arial, sans-serif;
                    direction: rtl;
                    padding: 20px;
                    background: white;
                    color: black;
                }
                .print-header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #000;
                    padding-bottom: 20px;
                }
                .print-header h1 {
                    font-size: 2rem;
                    color: #000;
                    margin: 0;
                }
                .print-item {
                    padding: 15px;
                    margin-bottom: 10px;
                    border: 2px solid #000;
                    border-radius: 8px;
                    page-break-inside: avoid;
                    background: #f9f9f9;
                }
                .print-item strong {
                    font-size: 1.2rem;
                    color: #000;
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>📦 مواقع المنتجات في المستودع</h1>
                <p style="margin: 10px 0; font-size: 1.2rem;">تاريخ: ${today}</p>
                <p style="margin: 5px 0; font-size: 1rem;">إجمالي المنتجات: ${results.length}</p>
            </div>
    `;
    
    // بناء HTML للمواقع
    sortedLocations.forEach(([locationKey, products]) => {
        const productInfo = products.map(p => 
            `${p.product_number} (${p.quantity} قطعة)`
        ).join(' | ');
        
        htmlContent += `
            <div class="print-item">
                <strong>📍 ${locationKey}</strong><br>
                <span>${productInfo}</span>
            </div>
        `;
    });
    
    // إضافة ملخص
    htmlContent += `
            <div class="print-item" style="background: #f0f0f0;">
                <strong>📊 الملخص</strong><br>
                <span>إجمالي المواقع: ${locationMap.size} | إجمالي المنتجات: ${results.length}</span>
            </div>
        </body>
        </html>
    `;
    
    // كتابة المحتوى للنافذة
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // انتظر ثم طباعة
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

// عرض تفاصيل المنتج عند النقر على الخلية
function showProductDetails(product, row, col) {
    // إنشاء modal للتفاصيل
    const modal = document.createElement('div');
    modal.id = 'product-details-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    // حساب الكمية المطلوبة والمتوفرة
    const availableQty = product.quantity || 0;
    const requestedQty = product.requested_quantity || 0;
    const shortage = requestedQty - availableQty;
    
    // تحديد حالة التوفر
    let statusIcon = '✅';
    let statusText = 'متوفر';
    let statusColor = '#10b981';
    let bgColor = '#dcfce7';
    let borderColor = '#22c55e';
    
    if (shortage > 0) {
        statusIcon = '⚠️';
        statusText = 'كمية غير كافية';
        statusColor = '#f59e0b';
        bgColor = '#fef3c7';
        borderColor = '#fbbf24';
    }
    
    if (!product.found) {
        statusIcon = '❌';
        statusText = 'غير موجود';
        statusColor = '#ef4444';
        bgColor = '#fee2e2';
        borderColor = '#f87171';
    }
    
    // محتوى Modal
    modal.innerHTML = `
        <div style="
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            max-width: 500px;
            width: 90%;
            position: relative;
            direction: rtl;
        ">
            <button onclick="this.closest('#product-details-modal').remove()" style="
                position: absolute;
                top: 15px;
                left: 15px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #64748b;
            ">×</button>
            
            <h2 style="margin-bottom: 20px; color: #1e293b; text-align: center;">📦 تفاصيل المنتج</h2>
            
            <div style="margin-bottom: 15px;">
                <div style="color: #64748b; font-size: 0.9rem; margin-bottom: 5px;">رقم المنتج</div>
                <div style="font-size: 1.2rem; font-weight: bold; color: #1e293b; font-family: monospace;">${product.product_number}</div>
            </div>
            
            ${product.name ? `
            <div style="margin-bottom: 15px;">
                <div style="color: #64748b; font-size: 0.9rem; margin-bottom: 5px;">اسم المنتج</div>
                <div style="font-size: 1rem; color: #1e293b;">${product.name}</div>
            </div>
            ` : ''}
            
            <div style="margin-bottom: 15px;">
                <div style="color: #64748b; font-size: 0.9rem; margin-bottom: 5px;">الموقع</div>
                <div style="font-size: 1.1rem; font-weight: bold; color: #667eea; font-family: monospace;">R${row}C${col}</div>
            </div>
            
            <div style="background: ${bgColor}; padding: 20px; border-radius: 8px; border-right: 4px solid ${borderColor}; margin: 20px 0;">
                <div style="font-size: 1.1rem; font-weight: bold; margin-bottom: 15px; color: ${statusColor}; text-align: center;">
                    ${statusIcon} ${statusText}
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="color: #64748b;">الكمية المتوفرة:</span>
                    <strong style="color: #059669; font-size: 1.1rem;">${availableQty} ${availableQty === 1 ? 'حبة' : 'حبات'}</strong>
                </div>
                
                ${requestedQty > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="color: #64748b;">الكمية المطلوبة:</span>
                    <strong style="color: #1e293b; font-size: 1.1rem;">${requestedQty} ${requestedQty === 1 ? 'حبة' : 'حبات'}</strong>
                </div>
                
                ${shortage > 0 ? `
                <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 2px solid ${borderColor};">
                    <span style="color: ${statusColor}; font-weight: bold;">النقص:</span>
                    <strong style="color: ${statusColor}; font-size: 1.2rem;">${shortage} ${shortage === 1 ? 'حبة' : 'حبات'}</strong>
                </div>
                ` : ''}
                ` : ''}
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
                <button onclick="this.closest('#product-details-modal').remove()" style="
                    background: #667eea;
                    color: white;
                    border: none;
                    padding: 12px 30px;
                    border-radius: 8px;
                    font-size: 1rem;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s;
                " onmouseover="this.style.background='#5568d3'" 
                   onmouseout="this.style.background='#667eea'">
                    إغلاق
                </button>
            </div>
        </div>
    `;
    
    // إغلاق عند النقر خارج Modal
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // إضافة Modal إلى الصفحة
    document.body.appendChild(modal);
}

// ==================== دوال الحفظ التلقائي ====================

/**
 * حفظ البيانات في LocalStorage
 */
function autoSaveData() {
    const productNumbers = productNumbersTextarea.value.trim();
    const recipientName = recipientNameInput ? recipientNameInput.value.trim() : '';
    
    // لا تحفظ إذا كانت البيانات فارغة
    if (!productNumbers && !recipientName) {
        return;
    }
    
    try {
        // حفظ البيانات
        localStorage.setItem(STORAGE_KEY, productNumbers);
        localStorage.setItem(STORAGE_RECIPIENT_KEY, recipientName);
        localStorage.setItem(STORAGE_TIMESTAMP_KEY, new Date().toISOString());
        
        // إظهار رسالة الحفظ
        showSaveStatus();
        
        // تحديث زر الاستعادة
        updateRestoreButton();
        
        console.log('✅ تم الحفظ التلقائي');
    } catch (error) {
        console.error('خطأ في الحفظ:', error);
    }
}

/**
 * استعادة البيانات من LocalStorage
 */
function restoreData() {
    try {
        const savedProducts = localStorage.getItem(STORAGE_KEY);
        const savedRecipient = localStorage.getItem(STORAGE_RECIPIENT_KEY);
        
        if (savedProducts || savedRecipient) {
            // تأكيد الاستعادة إذا كان هناك بيانات حالية
            const currentProducts = productNumbersTextarea.value.trim();
            const currentRecipient = recipientNameInput ? recipientNameInput.value.trim() : '';
            
            if (currentProducts || currentRecipient) {
                const confirmed = confirm('هل تريد استبدال البيانات الحالية بالبيانات المحفوظة؟');
                if (!confirmed) {
                    return;
                }
            }
            
            // استعادة البيانات
            if (savedProducts) {
                productNumbersTextarea.value = savedProducts;
                productNumbersTextarea.dispatchEvent(new Event('input'));
                productNumbersTextarea.focus();
            }
            if (savedRecipient && recipientNameInput) {
                recipientNameInput.value = savedRecipient;
                recipientNameInput.dispatchEvent(new Event('input'));
            }
            
            // إظهار رسالة نجاح
            showNotification('✅ تم استعادة البيانات بنجاح', 'success');
            
            console.log('✅ تم استعادة البيانات');
        } else {
            showNotification('⚠️ لا توجد بيانات محفوظة', 'warning');
        }
    } catch (error) {
        console.error('خطأ في الاستعادة:', error);
        showNotification('❌ حدث خطأ أثناء استعادة البيانات', 'error');
    }
}

/**
 * فحص وجود بيانات محفوظة عند تحميل الصفحة
 */
function checkForSavedData() {
    try {
        const savedProducts = localStorage.getItem(STORAGE_KEY);
        const savedTimestamp = localStorage.getItem(STORAGE_TIMESTAMP_KEY);
        
        if (savedProducts && savedTimestamp) {
            // إظهار زر الاستعادة
            updateRestoreButton();
            
            // إظهار معلومات آخر حفظ
            updateLastSavedInfo(savedTimestamp);
            
            console.log('📋 توجد بيانات محفوظة');
        }
    } catch (error) {
        console.error('خطأ في فحص البيانات:', error);
    }
}

/**
 * تحديث زر الاستعادة
 */
function updateRestoreButton() {
    const savedProducts = localStorage.getItem(STORAGE_KEY);
    
    if (savedProducts && restoreBtn) {
        restoreBtn.style.display = 'flex';
    }
}

/**
 * تحديث معلومات آخر حفظ
 */
function updateLastSavedInfo(timestamp) {
    if (!lastSavedInfo || !lastSavedTime) return;
    
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMinutes = Math.floor((now - date) / 60000);
        
        let timeText = '';
        if (diffMinutes < 1) {
            timeText = 'الآن';
        } else if (diffMinutes < 60) {
            timeText = `منذ ${diffMinutes} دقيقة`;
        } else if (diffMinutes < 1440) {
            const hours = Math.floor(diffMinutes / 60);
            timeText = `منذ ${hours} ساعة`;
        } else {
            timeText = date.toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        lastSavedTime.textContent = timeText;
        lastSavedInfo.style.display = 'block';
    } catch (error) {
        console.error('خطأ في تحديث وقت الحفظ:', error);
    }
}

/**
 * إظهار حالة الحفظ
 */
function showSaveStatus() {
    if (!autoSaveStatus) return;
    
    autoSaveStatus.style.display = 'inline';
    
    // إخفاء بعد 2 ثانية
    setTimeout(() => {
        autoSaveStatus.style.display = 'none';
    }, 2000);
    
    // تحديث معلومات آخر حفظ
    updateLastSavedInfo(new Date().toISOString());
}

/**
 * إظهار إشعار
 */
function showNotification(message, type = 'info') {
    // إنشاء عنصر الإشعار
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b'};
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    // إضافة الأنيميشن
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // إزالة بعد 3 ثواني
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 300);
    }, 3000);
}
