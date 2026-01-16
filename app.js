// Configuration
const SPREADSHEET_ID = '1besJUzbnISGH7oHSEEKsVwdXiVlFSZJAGfr4JsorxJM';
const SHEET_NAME = 'Sheet1'; // Adjust if your sheet has a different name

// Google Sheets public CSV export URL
const SHEETS_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`;

// State
let allCards = [];
let filteredCards = [];

// Column mapping (adjust indices based on your sheet structure)
const COLUMNS = {
    NUMBER: 0,      // Número
    NAME: 1,        // Nombre
    RARITY: 2,      // Rareza
    COLOR: 3,       // Color
    TYPE: 4,        // Tipo
    MANA_COST: 5,   // Coste de Maná
    CMC: 6,         // CMC
    SET: 7,         // Set
    PRICE_USD: 8,   // Precio USD
    PRICE_FOIL: 9,  // Precio USD Foil
    OWNED: 10,      // Tengo
    QUANTITY: 11,   // Cantidad
    FOIL: 12,       // Foil
    NOTES: 13,      // Notas
    IMAGE_URL: 14   // URL Imagen
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    document.getElementById('filter-rarity').addEventListener('change', applyFilters);
    document.getElementById('filter-owned').addEventListener('change', applyFilters);
    document.getElementById('filter-color').addEventListener('change', applyFilters);
    document.getElementById('search-input').addEventListener('input', debounce(applyFilters, 300));

    // Close modal on outside click
    document.getElementById('card-modal').addEventListener('click', (e) => {
        if (e.target.id === 'card-modal') {
            closeModal();
        }
    });

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Load data from Google Sheets
async function loadData() {
    showLoading(true);
    hideError();

    try {
        const response = await fetch(SHEETS_URL);
        const text = await response.text();

        // Parse the JSONP response from Google Sheets
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}') + 1;
        const jsonString = text.substring(jsonStart, jsonEnd);
        const data = JSON.parse(jsonString);

        // Extract rows from the response
        const rows = data.table.rows;

        // Skip header row and parse data
        allCards = rows.slice(0).map((row, index) => {
            const cells = row.c;
            return {
                id: index,
                number: getCellValue(cells[COLUMNS.NUMBER]),
                name: getCellValue(cells[COLUMNS.NAME]),
                rarity: getCellValue(cells[COLUMNS.RARITY]),
                color: getCellValue(cells[COLUMNS.COLOR]),
                type: getCellValue(cells[COLUMNS.TYPE]),
                manaCost: getCellValue(cells[COLUMNS.MANA_COST]),
                cmc: getCellValue(cells[COLUMNS.CMC]),
                set: getCellValue(cells[COLUMNS.SET]),
                priceUsd: getCellValue(cells[COLUMNS.PRICE_USD]),
                priceFoil: getCellValue(cells[COLUMNS.PRICE_FOIL]),
                owned: parseOwned(getCellValue(cells[COLUMNS.OWNED])),
                quantity: parseInt(getCellValue(cells[COLUMNS.QUANTITY])) || 0,
                foil: parseFoil(getCellValue(cells[COLUMNS.FOIL])),
                notes: getCellValue(cells[COLUMNS.NOTES]),
                imageUrl: getCellValue(cells[COLUMNS.IMAGE_URL])
            };
        }).filter(card => card.name); // Filter out empty rows

        filteredCards = [...allCards];

        updateStats();
        renderBinder();
        showLoading(false);

    } catch (error) {
        console.error('Error loading data:', error);
        showLoading(false);
        showError();
    }
}

// Get cell value safely
function getCellValue(cell) {
    if (!cell) return '';
    return cell.v !== null && cell.v !== undefined ? String(cell.v) : '';
}

// Parse owned field (handles "Si", "Sí", "Yes", "1", true, etc.)
function parseOwned(value) {
    if (!value) return false;
    const normalized = String(value).toLowerCase().trim();
    return ['si', 'sí', 'yes', '1', 'true', 'x'].includes(normalized);
}

// Parse foil field
function parseFoil(value) {
    if (!value) return false;
    const normalized = String(value).toLowerCase().trim();
    return ['si', 'sí', 'yes', '1', 'true', 'x', 'foil'].includes(normalized);
}

// Update all statistics
function updateStats() {
    updateTotalStats();
    updateRarityStats();
}

// Update total collection stats
function updateTotalStats() {
    const total = allCards.length;
    const owned = allCards.filter(card => card.owned).length;
    const percentage = total > 0 ? Math.round((owned / total) * 100) : 0;

    document.getElementById('owned-count').textContent = owned;
    document.getElementById('total-count').textContent = total;
    document.getElementById('total-percentage').textContent = `${percentage}%`;

    // Animate progress ring
    const progressRing = document.getElementById('total-progress');
    const circumference = 2 * Math.PI * 52; // radius = 52
    const offset = circumference - (percentage / 100) * circumference;
    progressRing.style.strokeDashoffset = offset;
}

// Update rarity statistics
function updateRarityStats() {
    const rarities = {
        'Common': { owned: 0, total: 0 },
        'Uncommon': { owned: 0, total: 0 },
        'Rare': { owned: 0, total: 0 },
        'Mythic': { owned: 0, total: 0 }
    };

    allCards.forEach(card => {
        const rarity = normalizeRarity(card.rarity);
        if (rarities[rarity]) {
            rarities[rarity].total++;
            if (card.owned) {
                rarities[rarity].owned++;
            }
        }
    });

    // Update Common
    updateRarityCard('common', rarities['Common']);

    // Update Uncommon
    updateRarityCard('uncommon', rarities['Uncommon']);

    // Update Rare
    updateRarityCard('rare', rarities['Rare']);

    // Update Mythic
    updateRarityCard('mythic', rarities['Mythic']);
}

// Normalize rarity names
function normalizeRarity(rarity) {
    if (!rarity) return 'Common';
    const normalized = rarity.toLowerCase().trim();

    if (normalized.includes('mythic') || normalized.includes('mítica')) return 'Mythic';
    if (normalized.includes('rare') || normalized.includes('rara')) return 'Rare';
    if (normalized.includes('uncommon') || normalized.includes('poco común') || normalized.includes('infrecuente')) return 'Uncommon';
    return 'Common';
}

// Update a rarity card
function updateRarityCard(rarityClass, stats) {
    document.getElementById(`${rarityClass}-owned`).textContent = stats.owned;
    document.getElementById(`${rarityClass}-total`).textContent = stats.total;

    const percentage = stats.total > 0 ? (stats.owned / stats.total) * 100 : 0;
    document.getElementById(`${rarityClass}-bar`).style.width = `${percentage}%`;
}

// Apply filters
function applyFilters() {
    const rarityFilter = document.getElementById('filter-rarity').value;
    const ownedFilter = document.getElementById('filter-owned').value;
    const colorFilter = document.getElementById('filter-color').value;
    const searchTerm = document.getElementById('search-input').value.toLowerCase();

    filteredCards = allCards.filter(card => {
        // Rarity filter
        if (rarityFilter !== 'all' && normalizeRarity(card.rarity) !== rarityFilter) {
            return false;
        }

        // Owned filter
        if (ownedFilter === 'owned' && !card.owned) {
            return false;
        }
        if (ownedFilter === 'missing' && card.owned) {
            return false;
        }

        // Color filter
        if (colorFilter !== 'all') {
            const cardColor = normalizeColor(card.color);
            if (cardColor !== colorFilter) {
                return false;
            }
        }

        // Search filter
        if (searchTerm && !card.name.toLowerCase().includes(searchTerm)) {
            return false;
        }

        return true;
    });

    renderBinder();
}

// Normalize color
function normalizeColor(color) {
    if (!color) return 'Colorless';
    const normalized = color.toUpperCase().trim();

    // Check for multicolor (contains multiple color letters or explicit multicolor)
    const colorLetters = ['W', 'U', 'B', 'R', 'G'];
    const foundColors = colorLetters.filter(c => normalized.includes(c));

    if (foundColors.length > 1) return 'Multicolor';
    if (foundColors.length === 1) return foundColors[0];

    if (normalized.includes('WHITE') || normalized.includes('BLANCO')) return 'W';
    if (normalized.includes('BLUE') || normalized.includes('AZUL')) return 'U';
    if (normalized.includes('BLACK') || normalized.includes('NEGRO')) return 'B';
    if (normalized.includes('RED') || normalized.includes('ROJO')) return 'R';
    if (normalized.includes('GREEN') || normalized.includes('VERDE')) return 'G';
    if (normalized.includes('MULTI')) return 'Multicolor';

    return 'Colorless';
}

// Render binder
function renderBinder() {
    const binderGrid = document.getElementById('binder-grid');
    binderGrid.innerHTML = '';

    // Sort cards by number
    const sortedCards = [...filteredCards].sort((a, b) => {
        const numA = parseInt(a.number) || 0;
        const numB = parseInt(b.number) || 0;
        return numA - numB;
    });

    sortedCards.forEach(card => {
        const cardElement = createCardElement(card);
        binderGrid.appendChild(cardElement);
    });
}

// Create card element
function createCardElement(card) {
    const div = document.createElement('div');
    div.className = `card-slot ${card.owned ? 'owned' : 'missing'}`;
    div.onclick = () => openModal(card);

    // Card image
    const img = document.createElement('img');
    img.src = card.imageUrl || 'https://via.placeholder.com/244x340?text=No+Image';
    img.alt = card.name;
    img.loading = 'lazy';
    img.onerror = () => {
        img.src = 'https://via.placeholder.com/244x340?text=No+Image';
    };
    div.appendChild(img);

    // Card number badge
    if (card.number) {
        const numberBadge = document.createElement('span');
        numberBadge.className = 'card-number';
        numberBadge.textContent = `#${card.number}`;
        div.appendChild(numberBadge);
    }

    // Owned badge (only for owned cards)
    if (card.owned && card.quantity > 0) {
        const ownedBadge = document.createElement('span');
        ownedBadge.className = 'owned-badge';
        ownedBadge.textContent = `x${card.quantity}`;
        div.appendChild(ownedBadge);
    }

    // Foil badge
    if (card.foil) {
        const foilBadge = document.createElement('span');
        foilBadge.className = 'foil-badge';
        foilBadge.textContent = 'FOIL';
        div.appendChild(foilBadge);
    }

    // Rarity indicator
    const rarityIndicator = document.createElement('span');
    rarityIndicator.className = `card-rarity-indicator ${normalizeRarity(card.rarity).toLowerCase()}`;
    rarityIndicator.textContent = getRarityLetter(card.rarity);
    div.appendChild(rarityIndicator);

    return div;
}

// Get rarity letter
function getRarityLetter(rarity) {
    const normalized = normalizeRarity(rarity);
    return normalized.charAt(0);
}

// Open modal
function openModal(card) {
    const modal = document.getElementById('card-modal');

    document.getElementById('modal-image').src = card.imageUrl || 'https://via.placeholder.com/244x340?text=No+Image';
    document.getElementById('modal-name').textContent = card.name;
    document.getElementById('modal-type').textContent = card.type;

    const rarityBadge = document.getElementById('modal-rarity');
    rarityBadge.textContent = card.rarity;
    rarityBadge.className = `rarity-badge ${normalizeRarity(card.rarity).toLowerCase()}`;

    document.getElementById('modal-color').textContent = getColorName(card.color);
    document.getElementById('modal-mana').textContent = card.manaCost ? `Maná: ${card.manaCost}` : '';

    document.getElementById('modal-price').textContent = card.priceUsd ? `$${card.priceUsd}` : 'N/A';
    document.getElementById('modal-price-foil').textContent = card.priceFoil ? `$${card.priceFoil}` : 'N/A';

    const ownedStatus = document.getElementById('modal-owned-status');
    ownedStatus.textContent = card.owned ? '✓ En tu colección' : '✗ No la tienes';
    ownedStatus.className = card.owned ? 'owned' : 'missing';

    document.getElementById('modal-quantity').textContent = card.owned ? `Cantidad: ${card.quantity}` : '';
    document.getElementById('modal-foil').textContent = card.foil ? '✨ Versión Foil' : '';
    document.getElementById('modal-notes').textContent = card.notes ? `Notas: ${card.notes}` : '';

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal() {
    const modal = document.getElementById('card-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

// Get color name
function getColorName(color) {
    const colorMap = {
        'W': 'Blanco',
        'U': 'Azul',
        'B': 'Negro',
        'R': 'Rojo',
        'G': 'Verde',
        'Multicolor': 'Multicolor',
        'Colorless': 'Incoloro'
    };

    const normalized = normalizeColor(color);
    return colorMap[normalized] || color || 'Incoloro';
}

// Show/hide loading
function showLoading(show) {
    const loading = document.getElementById('loading');
    const summary = document.getElementById('summary');
    const rarityStats = document.getElementById('rarity-stats');
    const filters = document.getElementById('filters');
    const binder = document.getElementById('binder');

    if (show) {
        loading.classList.remove('hidden');
        summary.classList.add('hidden');
        rarityStats.classList.add('hidden');
        filters.classList.add('hidden');
        binder.classList.add('hidden');
    } else {
        loading.classList.add('hidden');
        summary.classList.remove('hidden');
        rarityStats.classList.remove('hidden');
        filters.classList.remove('hidden');
        binder.classList.remove('hidden');
    }
}

// Show error
function showError() {
    document.getElementById('error').classList.remove('hidden');
}

// Hide error
function hideError() {
    document.getElementById('error').classList.add('hidden');
}
