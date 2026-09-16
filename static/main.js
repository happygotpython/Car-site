let allVehicles = [];
let activeTab = 'sale';
let compareList = [];
let selectedFiles = [];
let editingCarId = null;

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    updateWishlistBadge();
    fetchVehicles();
    setupEventListeners();
});

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, match => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[match]));
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const html = document.documentElement;
    const newTheme = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
}

// Popularity Metrics Helpers
function getMetrics() {
    try {
        return JSON.parse(localStorage.getItem('drivenation_metrics')) || {};
    } catch (e) {
        return {};
    }
}

function trackView(carId) {
    if (!carId) return;
    const metrics = getMetrics();
    if (!metrics[carId]) metrics[carId] = { views: 0, wishlist: 0 };
    metrics[carId].views += 1;
    localStorage.setItem('drivenation_metrics', JSON.stringify(metrics));
}

function trackWishlistMetric(carId, added) {
    if (!carId) return;
    const metrics = getMetrics();
    if (!metrics[carId]) metrics[carId] = { views: 0, wishlist: 0 };
    metrics[carId].wishlist += added ? 1 : -1;
    if (metrics[carId].wishlist < 0) metrics[carId].wishlist = 0;
    localStorage.setItem('drivenation_metrics', JSON.stringify(metrics));
}

function getPopularityBadge(carId) {
    const metrics = getMetrics()[carId] || { views: 0, wishlist: 0 };
    if (metrics.views >= 5 || metrics.wishlist >= 2) {
        return `<span class="badge hot-badge" style="background:#f39c12; color:#fff; position:absolute; top: 10px; left: 10px; z-index:2;">🔥 Popular</span>`;
    }
    return '';
}

// Wishlist Helpers
function getWishlist() {
    try {
        return JSON.parse(localStorage.getItem('drivenation_wishlist')) || [];
    } catch (e) {
        return [];
    }
}

function saveWishlist(list) {
    localStorage.setItem('drivenation_wishlist', JSON.stringify(list));
    updateWishlistBadge();
}

function updateWishlistBadge() {
    const wishlist = getWishlist();
    const badge = document.getElementById('wishlist-badge');
    if (badge) {
        badge.textContent = wishlist.length;
    }
}

function toggleWishlist(carTitle) {
    let wishlist = getWishlist();
    const isAdding = !wishlist.includes(carTitle);
    
    if (wishlist.includes(carTitle)) {
        wishlist = wishlist.filter(title => title !== carTitle);
    } else {
        wishlist.push(carTitle);
    }

    const targetCar = allVehicles.find(v => v.title === carTitle);
    if (targetCar) trackWishlistMetric(targetCar.id, isAdding);

    saveWishlist(wishlist);
    renderInventory();

    const wishlistModal = document.getElementById('wishlist-modal');
    if (wishlistModal && wishlistModal.classList.contains('active')) {
        renderWishlistModal();
    }
}

function openWishlistModal() {
    renderWishlistModal();
    const modal = document.getElementById('wishlist-modal');
    if (modal) modal.classList.add('active');
}

function closeWishlistModal() {
    const modal = document.getElementById('wishlist-modal');
    if (modal) modal.classList.remove('active');
}

function renderWishlistModal() {
    const container = document.getElementById('wishlist-modal-body');
    if (!container) return;

    const wishlist = getWishlist();
    const savedVehicles = allVehicles.filter(v => wishlist.includes(v.title));

    if (savedVehicles.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 2rem 0;">Your wishlist is currently empty.</p>`;
        return;
    }

    let html = `<div class="wishlist-grid" style="display: flex; flex-direction: column; gap: 1rem;">`;
    savedVehicles.forEach(car => {
        const safeTitle = car.title ? car.title.replace(/\\/g, "\\\\").replace(/'/g, "\\'") : "";
        const images = Array.isArray(car.images) && car.images.length > 0 ? car.images : [car.image || '/static/placeholder.jpg'];
        const imageSrc = escapeHTML(images[0]);
        const priceDisplay = car.type === 'sale' 
            ? `$${car.price ? Number(car.price).toLocaleString() : 'N/A'}`
            : `$${car.dailyPrice ? escapeHTML(car.dailyPrice) : '0'}/day`;
        const encodedMsg = car.type === 'sale' 
            ? encodeURIComponent(`Hi, I want to inquire about buying the ${car.title || ''} (${priceDisplay}) on DRIVE-NATION GLOBAL.`)
            : encodeURIComponent(`Hi, I want to inquire about renting the ${car.title || ''} (${priceDisplay}) on DRIVE-NATION GLOBAL.`);

        html += `
            <div class="wishlist-item" style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem; border: 1px solid var(--border); border-radius: 8px;">
                <img src="${imageSrc}" alt="${escapeHTML(car.title)}" style="width: 80px; height: 60px; object-fit: cover; border-radius: 6px;">
                <div style="flex: 1;">
                    <h4 style="margin: 0; font-size: 1rem;">${escapeHTML(car.title)}</h4>
                    <p style="margin: 0.25rem 0 0; color: var(--text-muted); font-size: 0.85rem;">${car.type === 'sale' ? (car.year ? escapeHTML(car.year) + ' • ' : '') + escapeHTML(car.specs || '') : escapeHTML(car.category || 'Rental') + ' • ' + escapeHTML(car.specs || '')}</p>
                    <strong style="color: var(--primary); font-size: 0.95rem;">${priceDisplay}</strong>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <button type="button" onclick="openDetailsModal(${car.id})" class="card-btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; background: var(--border);">Details</button>
                    <a href="https://wa.me/12272670270?text=${encodedMsg}" target="_blank" class="card-btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Inquire</a>
                    <button type="button" onclick="toggleWishlist('${escapeHTML(safeTitle)}')" style="background: none; border: 1px solid var(--border); border-radius: 4px; padding: 0.4rem 0.6rem; color: #e63946; cursor: pointer; font-size: 0.8rem;" title="Remove from wishlist">
                        Remove
                    </button>
                </div>
            </div>
        `;
    });
    html += `</div>`;
    container.innerHTML = html;
}

function setupEventListeners() {
    const searchInput = document.getElementById("search-input");
    const makeFilter = document.getElementById("filter-make");
    const catFilter = document.getElementById("filter-category");
    const sortSelect = document.getElementById("sort-by");
    const addVehicleForm = document.getElementById("add-vehicle-form");
    const multiImagesInput = document.getElementById("input-images");

    if (searchInput) searchInput.addEventListener("input", filterInventory);
    if (makeFilter) makeFilter.addEventListener("change", filterInventory);
    if (catFilter) catFilter.addEventListener("change", filterInventory);
    if (sortSelect) sortSelect.addEventListener("change", filterInventory);
    if (addVehicleForm) addVehicleForm.addEventListener("submit", handleFormSubmit);

    if (multiImagesInput) {
        multiImagesInput.addEventListener("change", (e) => {
            const files = Array.from(e.target.files);
            selectedFiles = selectedFiles.concat(files);
            renderPreviews();
            e.target.value = "";
        });
    }
}

function renderPreviews() {
    const container = document.getElementById("image-preview-container");
    if (!container) return;
    container.innerHTML = "";

    selectedFiles.forEach((file, index) => {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "position: relative; width: 65px; height: 65px;";

        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.style.cssText = "width: 100%; height: 100%; object-fit: cover; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2);";

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.innerHTML = "&times;";
        removeBtn.style.cssText = "position: absolute; top: -5px; right: -5px; background: #e63946; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;";
        removeBtn.onclick = () => {
            selectedFiles.splice(index, 1);
            renderPreviews();
        };

        wrapper.appendChild(img);
        wrapper.appendChild(removeBtn);
        container.appendChild(wrapper);
    });
}

async function fetchVehicles() {
    try {
        const response = await fetch(`/api/cars?t=${Date.now()}`);
        allVehicles = await response.json();
        populateMakeDropdown();
        renderInventory();
    } catch (err) {
        console.error("Failed to load cars:", err);
    }
}

function populateMakeDropdown() {
    const makeSelect = document.getElementById("filter-make");
    if (!makeSelect) return;

    const currentSelection = makeSelect.value;
    const uniqueMakes = [...new Set(allVehicles.filter(v => v.type === 'sale').map(v => v.make).filter(Boolean))];

    makeSelect.innerHTML = '<option value="all">All Makes</option>';
    uniqueMakes.forEach(make => {
        const option = document.createElement("option");
        option.value = make;
        option.textContent = make;
        makeSelect.appendChild(option);
    });

    if (uniqueMakes.includes(currentSelection)) {
        makeSelect.value = currentSelection;
    }
}

function switchInventoryTab(tab) {
    activeTab = tab;
    const saleBtn = document.getElementById("tab-sale-btn");
    const rentBtn = document.getElementById("tab-rent-btn");
    const filtersSale = document.getElementById("filters-sale");
    const filtersRent = document.getElementById("filters-rent");

    if (saleBtn) saleBtn.classList.toggle("active", tab === 'sale');
    if (rentBtn) rentBtn.classList.toggle("active", tab === 'rent');
    if (filtersSale) filtersSale.classList.toggle("hidden", tab !== 'sale');
    if (filtersRent) filtersRent.classList.toggle("hidden", tab !== 'rent');

    renderInventory();
}

function filterInventory() {
    renderInventory();
}

function renderInventory() {
    const grid = document.getElementById("car-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const searchInput = document.getElementById("search-input");
    const sortSelect = document.getElementById("sort-by");
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const sortOption = sortSelect ? sortSelect.value : "default";
    const wishlist = getWishlist();

    let filteredVehicles = allVehicles.filter(v => {
        if (activeTab === 'sale') {
            const makeFilter = document.getElementById("filter-make") ? document.getElementById("filter-make").value : 'all';
            const matchesMake = makeFilter === 'all' || v.make === makeFilter;
            const matchesSearch = !searchQuery || 
                (v.title && v.title.toLowerCase().includes(searchQuery)) ||
                (v.make && v.make.toLowerCase().includes(searchQuery)) ||
                (v.specs && v.specs.toLowerCase().includes(searchQuery)) ||
                (v.year && v.year.toString().includes(searchQuery));
            return v.type === 'sale' && matchesMake && matchesSearch;
        } else {
            const catFilter = document.getElementById("filter-category") ? document.getElementById("filter-category").value : 'all';
            const matchesCategory = catFilter === 'all' || v.category === catFilter;
            const matchesSearch = !searchQuery || 
                (v.title && v.title.toLowerCase().includes(searchQuery)) ||
                (v.category && v.category.toLowerCase().includes(searchQuery)) ||
                (v.specs && v.specs.toLowerCase().includes(searchQuery));
            return v.type === 'rent' && matchesCategory && matchesSearch;
        }
    });

    // Dynamic Sorting Logic
    filteredVehicles.sort((a, b) => {
        const priceA = a.type === 'sale' ? (Number(a.price) || 0) : (Number(a.dailyPrice) || 0);
        const priceB = b.type === 'sale' ? (Number(b.price) || 0) : (Number(b.dailyPrice) || 0);

        if (sortOption === 'price-asc') return priceA - priceB;
        if (sortOption === 'price-desc') return priceB - priceA;
        if (sortOption === 'year-desc') return (Number(b.year) || 0) - (Number(a.year) || 0);
        if (sortOption === 'mileage-asc') return (Number(a.mileage) || 0) - (Number(b.mileage) || 0);
        return 0;
    });

    if (filteredVehicles.length === 0) {
        grid.innerHTML = `<p class="no-results">No vehicles found matching your criteria.</p>`;
        return;
    }

    filteredVehicles.forEach(car => {
        const isComparing = compareList.includes(car.title);
        const isWishlisted = wishlist.includes(car.title);
        const safeTitle = car.title ? car.title.replace(/\\/g, "\\\\").replace(/'/g, "\\'") : "";
        const images = Array.isArray(car.images) && car.images.length > 0 ? car.images : [car.image || '/static/placeholder.jpg'];
        const imageSrc = escapeHTML(images[0]);
        const popBadge = getPopularityBadge(car.id);

        if (car.type === 'sale') {
            const encodedMsg = encodeURIComponent(`Hi, I want to buy the ${car.title || ''} ($${car.price ? Number(car.price).toLocaleString() : 'N/A'}) on DRIVE-NATION GLOBAL.`);
            const stockBadge = (car.stock !== undefined && car.stock <= 0)
                ? `<span class="badge out-stock" style="background:#e63946; top: 10px; left: 10px;">Sold Out</span>`
                : `<span class="badge">For Sale ${car.stock ? `(${car.stock})` : ''}</span>`;

            grid.innerHTML += `
                <div class="card" onclick="openDetailsModal(${car.id})">
                    <div class="card-image" style="background-image: url('${imageSrc}')">
                        ${popBadge || stockBadge}
                        <button type="button" class="wishlist-toggle-btn ${isWishlisted ? 'active' : ''}" onclick="event.stopPropagation(); toggleWishlist('${escapeHTML(safeTitle)}');" title="${isWishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); border: none; border-radius: 50%; width: 34px; height: 34px; cursor: pointer; color: ${isWishlisted ? '#e63946' : '#fff'}; display: flex; align-items: center; justify-content: center; z-index: 2;">
                            <svg viewBox="0 0 24 24" width="18" height="18">
                                <path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                        </button>
                        <button type="button" class="compare-toggle-btn ${isComparing ? 'active' : ''}" onclick="event.stopPropagation(); toggleCompare('${escapeHTML(safeTitle)}');">
                            ${isComparing ? 'Selected for Compare' : '+ Compare'}
                        </button>
                        <div class="zoom-icon">Click for Details</div>
                    </div>
                    <div class="card-body">
                        <h3 class="card-title">${escapeHTML(car.title)}</h3>
                        <p class="card-specs">${car.year ? escapeHTML(car.year) : ''} &bull; ${car.mileage ? Number(car.mileage).toLocaleString() + ' mi' : ''} &bull; ${escapeHTML(car.specs)}</p>
                    </div>
                    <div class="card-footer" onclick="event.stopPropagation();">
                        <div>
                            <span style="font-size: 0.7rem; color: var(--text-muted); display:block;">PRICE</span>
                            <span class="price-value">$${car.price ? Number(car.price).toLocaleString() : 'N/A'}</span>
                        </div>
                        <div style="display: flex; gap: 0.4rem; align-items: center;">
                            <a href="https://wa.me/12272670270?text=${encodedMsg}" target="_blank" class="card-btn">Inquire</a>
                            <button type="button" onclick="editVehicle(${car.id})" class="card-btn" style="background: var(--border);" title="Edit Vehicle">✏️</button>
                            <button type="button" onclick="deleteVehicle(${car.id})" class="card-btn" style="background: #e63946; color: white;" title="Delete Vehicle">🗑️</button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            const encodedMsg = encodeURIComponent(`Hi, I want to rent the ${car.title || ''} ($${car.dailyPrice || 0}/day) on DRIVE-NATION GLOBAL.`);

            grid.innerHTML += `
                <div class="card" onclick="openDetailsModal(${car.id})">
                    <div class="card-image" style="background-image: url('${imageSrc}')">
                        ${popBadge || `<span class="badge">For Rent</span>`}
                        <button type="button" class="wishlist-toggle-btn ${isWishlisted ? 'active' : ''}" onclick="event.stopPropagation(); toggleWishlist('${escapeHTML(safeTitle)}');" title="${isWishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); border: none; border-radius: 50%; width: 34px; height: 34px; cursor: pointer; color: ${isWishlisted ? '#e63946' : '#fff'}; display: flex; align-items: center; justify-content: center; z-index: 2;">
                            <svg viewBox="0 0 24 24" width="18" height="18">
                                <path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                        </button>
                        <button type="button" class="compare-toggle-btn ${isComparing ? 'active' : ''}" onclick="event.stopPropagation(); toggleCompare('${escapeHTML(safeTitle)}');">
                            ${isComparing ? 'Selected for Compare' : '+ Compare'}
                        </button>
                        <div class="zoom-icon">Click for Details</div>
                    </div>
                    <div class="card-body">
                        <h3 class="card-title">${escapeHTML(car.title)}</h3>
                        <p class="card-specs">${escapeHTML(car.category || 'Rental')} &bull; ${escapeHTML(car.specs)}</p>
                    </div>
                    <div class="card-footer" onclick="event.stopPropagation();">
                        <div>
                            <span style="font-size: 0.7rem; color: var(--text-muted); display:block;">RATE</span>
                            <span class="price-value">$${car.dailyPrice ? escapeHTML(car.dailyPrice) : '0'} <small style="font-size: 0.75rem;">/day</small></span>
                        </div>
                        <div style="display: flex; gap: 0.4rem; align-items: center;">
                            <a href="https://wa.me/12272670270?text=${encodedMsg}" target="_blank" class="card-btn">Book</a>
                            <button type="button" onclick="editVehicle(${car.id})" class="card-btn" style="background: var(--border);" title="Edit Vehicle">✏️</button>
                            <button type="button" onclick="deleteVehicle(${car.id})" class="card-btn" style="background: #e63946; color: white;" title="Delete Vehicle">🗑️</button>
                        </div>
                    </div>
                </div>
            `;
        }
    });
}

function openDetailsModal(carId) {
    const car = allVehicles.find(v => v.id === carId || v.id == carId);
    if (!car) return;

    trackView(car.id);

    const modal = document.getElementById("details-modal");
    const titleEl = document.getElementById("modal-car-title");
    const bodyEl = document.getElementById("details-modal-body");
    if (!modal || !bodyEl) return;

    if (titleEl) titleEl.textContent = car.title || "Vehicle Details";

    const images = (Array.isArray(car.images) && car.images.length > 0)
        ? car.images
        : [car.image || '/static/placeholder.jpg'];

    const isSale = car.type === 'sale';
    const priceDisplay = isSale
        ? `$${car.price ? Number(car.price).toLocaleString() : 'N/A'}`
        : `$${car.dailyPrice ? escapeHTML(car.dailyPrice) : '0'}/day`;

    const stockBadge = (car.stock !== undefined && car.stock <= 0)
        ? `<span class="badge out-stock" style="background: #e63946; color: #fff; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">Out of Stock</span>`
        : `<span class="badge in-stock" style="background: #2a9d8f; color: #fff; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">In Stock (${car.stock || 1})</span>`;

    const encodedMsg = encodeURIComponent(
        `Hi, I want to inquire about the ${car.title || ''} (${priceDisplay}) on DRIVE-NATION GLOBAL.`
    );

    let thumbsHTML = '';
    if (images.length > 1) {
        thumbsHTML = `<div class="gallery-thumbnails" style="display: flex; gap: 0.5rem; margin-top: 0.75rem; overflow-x: auto; padding-bottom: 0.5rem;">` +
            images.map((img, idx) => `
                <img src="${escapeHTML(img)}" alt="Thumbnail ${idx+1}" onclick="setMainImage('${escapeHTML(img)}')" style="width: 70px; height: 50px; object-fit: cover; border-radius: 4px; cursor: pointer; border: 2px solid var(--border);" class="gallery-thumb">
            `).join('') +
            `</div>`;
    }

    bodyEl.innerHTML = `
        <div class="details-modal-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
            <div class="details-gallery">
                <img id="gallery-main-img" src="${escapeHTML(images[0])}" alt="${escapeHTML(car.title)}" style="width: 100%; max-height: 320px; object-fit: cover; border-radius: 8px; cursor: pointer;" onclick="openLightbox(this.src)">
                ${thumbsHTML}
            </div>
            <div class="details-info" style="display: flex; flex-direction: column; gap: 0.75rem;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span class="badge ${isSale ? 'sale' : 'rent'}">${isSale ? 'For Sale' : 'For Rent'}</span>
                    ${stockBadge}
                </div>
                <h3 style="margin: 0; font-size: 1.4rem;">${escapeHTML(car.title)}</h3>
                <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">${priceDisplay}</div>
                
                <div class="details-specs-list" style="border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 0.75rem 0; margin: 0.5rem 0; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.9rem;">
                    ${isSale ? `<div><strong>Year:</strong> ${car.year || 'N/A'}</div>` : ''}
                    ${isSale ? `<div><strong>Mileage:</strong> ${car.mileage ? Number(car.mileage).toLocaleString() + ' mi' : 'N/A'}</div>` : ''}
                    ${!isSale ? `<div><strong>Category:</strong> ${escapeHTML(car.category || 'Rental')}</div>` : ''}
                    <div><strong>Make:</strong> ${escapeHTML(car.make || 'N/A')}</div>
                    <div><strong>Drivetrain:</strong> ${escapeHTML(car.drivetrain || 'N/A')}</div>
                    <div><strong>Fuel Type:</strong> ${escapeHTML(car.fuelType || 'Gasoline')}</div>
                </div>

                <div>
                    <strong>Specifications & Description:</strong>
                    <p style="margin-top: 0.25rem; color: var(--text-muted); font-size: 0.9rem;">${escapeHTML(car.specs || 'No additional details available.')}</p>
                </div>

                <a href="https://wa.me/12272670270?text=${encodedMsg}" target="_blank" class="card-btn" style="text-align: center; margin-top: auto; padding: 0.75rem;">Inquire on WhatsApp</a>
            </div>
        </div>
    `;

    modal.classList.add("active");
}

function closeDetailsModal() {
    const modal = document.getElementById("details-modal");
    if (modal) modal.classList.remove("active");
}

function setMainImage(url) {
    const mainImg = document.getElementById("gallery-main-img");
    if (mainImg) mainImg.src = url;
}

function openLightbox(imageSrc) {
    let lightbox = document.getElementById("image-lightbox");
    if (!lightbox) {
        lightbox = document.createElement("div");
        lightbox.id = "image-lightbox";
        lightbox.className = "lightbox-overlay";
        lightbox.onclick = closeLightbox;
        lightbox.innerHTML = `
            <span class="lightbox-close" onclick="closeLightbox(event)">&times;</span>
            <img id="lightbox-img" class="lightbox-content" alt="Enlarged Vehicle Image">
        `;
        document.body.appendChild(lightbox);
    }
    const lightboxImg = document.getElementById("lightbox-img");
    if (lightboxImg) {
        lightboxImg.src = imageSrc;
    }
    lightbox.classList.add("active");
}

function closeLightbox(e) {
    const lightbox = document.getElementById("image-lightbox");
    if (lightbox) {
        lightbox.classList.remove("active");
    }
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeLightbox();
        closeDetailsModal();
        closeWishlistModal();
        closeCompareModal();
    }
});

// Admin CRUD Operations
function openAdminModal() { 
    const modal = document.getElementById("admin-modal") || document.getElementById("vehicle-modal");
    if (modal) modal.classList.add("active"); 
}

function closeAdminModal() { 
    const modal = document.getElementById("admin-modal") || document.getElementById("vehicle-modal");
    if (modal) modal.classList.remove("active"); 
    editingCarId = null;
    selectedFiles = [];
    renderPreviews();

    const form = document.getElementById("add-vehicle-form");
    if (form) form.reset();

    const submitBtn = form?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.innerText = 'Publish Vehicle';
}

function editVehicle(carId) {
    const car = allVehicles.find(v => v.id == carId);
    if (!car) return;

    editingCarId = car.id;
    openAdminModal();

    const form = document.getElementById("add-vehicle-form");
    if (document.getElementById("input-type")) document.getElementById("input-type").value = car.type || 'sale';
    toggleFormFields();

    if (document.getElementById("input-title")) document.getElementById("input-title").value = car.title || '';
    if (document.getElementById("input-specs")) document.getElementById("input-specs").value = car.specs || '';
    if (document.getElementById("input-stock")) document.getElementById("input-stock").value = car.stock ?? 1;

    if (car.type === 'sale') {
        if (document.getElementById("input-make")) document.getElementById("input-make").value = car.make || 'Other';
        if (document.getElementById("input-year")) document.getElementById("input-year").value = car.year || '';
        if (document.getElementById("input-price")) document.getElementById("input-price").value = car.price || '';
        if (document.getElementById("input-mileage")) document.getElementById("input-mileage").value = car.mileage || '';
    } else {
        if (document.getElementById("input-category")) document.getElementById("input-category").value = car.category || '';
        if (document.getElementById("input-daily")) document.getElementById("input-daily").value = car.dailyPrice || '';
    }

    const submitBtn = form?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.innerText = "Update Vehicle";
}

async function deleteVehicle(carId) {
    if (!confirm("Are you sure you want to delete this vehicle listing?")) return;

    try {
        const response = await fetch(`/api/cars/${carId}`, { method: 'DELETE' });
        if (response.ok) {
            allVehicles = allVehicles.filter(v => v.id != carId);
            renderInventory();
            populateMakeDropdown();
            alert("Vehicle deleted successfully!");
        } else {
            alert("Failed to delete vehicle.");
        }
    } catch (err) {
        console.error("Error deleting vehicle:", err);
        alert("Error deleting vehicle.");
    }
}

function toggleFormFields() {
    const typeSelect = document.getElementById("input-type");
    if (!typeSelect) return;
    const type = typeSelect.value;
    const fieldsSale = document.getElementById("fields-sale");
    const fieldsRent = document.getElementById("fields-rent");
    if (fieldsSale) fieldsSale.classList.toggle("hidden", type !== 'sale');
    if (fieldsRent) fieldsRent.classList.toggle("hidden", type !== 'rent');
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const typeInput = document.getElementById("input-type");
    if (!typeInput) return;

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]') || document.querySelector('#add-vehicle-form button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerText : 'Publish Vehicle';

    const type = typeInput.value;
    const formData = new FormData();

    formData.append("type", type);
    formData.append("title", document.getElementById("input-title")?.value || "");
    formData.append("specs", document.getElementById("input-specs")?.value || "");
    formData.append("stock", document.getElementById("input-stock")?.value || "1");

    const multiImagesInput = document.getElementById("input-images");
    const singleImageInput = document.getElementById("input-image");

    if (selectedFiles.length > 0) {
        selectedFiles.forEach(file => {
            formData.append("images", file);
        });
    } else if (multiImagesInput && multiImagesInput.files && multiImagesInput.files.length > 0) {
        for (let i = 0; i < multiImagesInput.files.length; i++) {
            formData.append("images", multiImagesInput.files[i]);
        }
    } else if (singleImageInput && singleImageInput.files && singleImageInput.files[0]) {
        formData.append("image", singleImageInput.files[0]);
    }

    if (type === 'sale') {
        formData.append("make", document.getElementById("input-make")?.value || 'Other');
        formData.append("year", document.getElementById("input-year")?.value || '2024');
        formData.append("price", document.getElementById("input-price")?.value || '0');
        formData.append("mileage", document.getElementById("input-mileage")?.value || '0');
    } else {
        formData.append("category", document.getElementById("input-category")?.value || 'Rental');
        formData.append("dailyPrice", document.getElementById("input-daily")?.value || '0');
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = editingCarId ? "Updating..." : "Uploading...";
    }

    try {
        const url = editingCarId ? `/api/cars/${editingCarId}` : '/api/cars';
        const method = editingCarId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            body: formData
        });

        if (response.ok) {
            alert(editingCarId ? "Vehicle updated successfully!" : "Vehicle published successfully!");
            closeAdminModal();
            if (typeof fetchVehicles === 'function') fetchVehicles();
            if (typeof fetchAdminVehicles === 'function') fetchAdminVehicles();
        } else {
            alert("Failed to save vehicle.");
        }
    } catch (err) {
        console.error("Error saving vehicle:", err);
        alert("Failed to save vehicle.");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
        }
    }
}

function toggleCompare(carTitle) {
    const index = compareList.indexOf(carTitle);
    if (index > -1) {
        compareList.splice(index, 1);
    } else {
        if (compareList.length >= 3) {
            alert("You can select up to 3 vehicles to compare at a time.");
            return;
        }
        compareList.push(carTitle);
    }
    updateCompareBar();
    renderInventory();
    
    const modal = document.getElementById("compare-modal");
    if (modal && modal.classList.contains("active")) {
        renderCompareModal();
    }
}

function clearCompareList() {
    compareList = [];
    updateCompareBar();
    renderInventory();
}

function updateCompareBar() {
    const compareBar = document.getElementById("compare-bar");
    const compareCount = document.getElementById("compare-count");
    if (!compareBar || !compareCount) return;

    compareCount.textContent = compareList.length;
    if (compareList.length > 0) {
        compareBar.classList.remove("hidden");
    } else {
        compareBar.classList.add("hidden");
    }
}

function openCompareModal() {
    if (compareList.length < 2) {
        alert("Please select at least 2 vehicles to compare.");
        return;
    }
    renderCompareModal();
    const modal = document.getElementById("compare-modal");
    if (modal) modal.classList.add("active");
}

function closeCompareModal() {
    const modal = document.getElementById("compare-modal");
    if (modal) modal.classList.remove("active");
}

function renderCompareModal() {
    const container = document.getElementById("compare-modal-body");
    if (!container) return;

    const selectedVehicles = allVehicles.filter(v => compareList.includes(v.title));

    if (selectedVehicles.length === 0) {
        container.innerHTML = "<p>No vehicles selected for comparison.</p>";
        return;
    }

    let html = `
        <div class="compare-table-wrapper">
            <table class="compare-table">
                <thead>
                    <tr>
                        <th class="feature-col">Feature</th>`;

    selectedVehicles.forEach(car => {
        const safeTitle = car.title ? car.title.replace(/\\/g, "\\\\").replace(/'/g, "\\'") : "";
        const images = Array.isArray(car.images) && car.images.length > 0 ? car.images : [car.image || '/static/placeholder.jpg'];
        const imageSrc = escapeHTML(images[0]);
        html += `
            <th>
                <div class="compare-header-cell">
                    <img src="${imageSrc}" alt="${escapeHTML(car.title)}" class="compare-thumb">
                    <h3>${escapeHTML(car.title)}</h3>
                    <button class="remove-compare-btn" onclick="toggleCompare('${escapeHTML(safeTitle)}')">Remove</button>
                </div>
            </th>`;
    });

    html += `</tr></thead><tbody>`;

    html += `<tr><td class="feature-label">Listing Type</td>`;
    selectedVehicles.forEach(car => {
        html += `<td><span class="badge ${car.type === 'sale' ? 'sale' : 'rent'}">${car.type === 'sale' ? 'For Sale' : 'For Rent'}</span></td>`;
    });
    html += `</tr>`;

    html += `<tr><td class="feature-label">Price / Rate</td>`;
    selectedVehicles.forEach(car => {
        const valueDisplay = car.type === 'sale' 
            ? `$${car.price ? Number(car.price).toLocaleString() : 'N/A'}`
            : `$${car.dailyPrice ? escapeHTML(car.dailyPrice) : '0'}/day`;
        html += `<td class="compare-highlight">${valueDisplay}</td>`;
    });
    html += `</tr>`;

    html += `<tr><td class="feature-label">Year</td>`;
    selectedVehicles.forEach(car => {
        html += `<td>${car.year ? escapeHTML(car.year) : 'N/A'}</td>`;
    });
    html += `</tr>`;

    html += `<tr><td class="feature-label">Mileage</td>`;
    selectedVehicles.forEach(car => {
        html += `<td>${car.mileage ? Number(car.mileage).toLocaleString() + ' mi' : 'N/A (Rental)'}</td>`;
    });
    html += `</tr>`;

    html += `<tr><td class="feature-label">Drivetrain</td>`;
    selectedVehicles.forEach(car => {
        html += `<td>${escapeHTML(car.drivetrain || 'N/A')}</td>`;
    });
    html += `</tr>`;

    html += `<tr><td class="feature-label">Fuel Type</td>`;
    selectedVehicles.forEach(car => {
        html += `<td>${escapeHTML(car.fuelType || 'Gasoline')}</td>`;
    });
    html += `</tr>`;

    html += `<tr><td class="feature-label">Specifications</td>`;
    selectedVehicles.forEach(car => {
        html += `<td>${escapeHTML(car.specs || 'N/A')}</td>`;
    });
    html += `</tr>`;

    html += `<tr><td class="feature-label">Inquire</td>`;
    selectedVehicles.forEach(car => {
        const encodedMsg = car.type === 'sale' 
            ? encodeURIComponent(`Hi, I want to inquire about buying the ${car.title || ''} ($${car.price ? Number(car.price).toLocaleString() : 'N/A'}).`)
            : encodeURIComponent(`Hi, I want to inquire about renting the ${car.title || ''} ($${car.dailyPrice || 0}/day).`);
        
        html += `
            <td>
                <a href="https://wa.me/12272670270?text=${encodedMsg}" target="_blank" class="card-btn">Inquire on WhatsApp</a>
            </td>`;
    });
    html += `</tr>`;

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

function toggleFaq(btn) { 
    if (btn && btn.parentElement) {
        btn.parentElement.classList.toggle("active");
    }
}