let allVehicles = [];
let activeTab = 'sale';
let compareList = [];

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
    if (wishlist.includes(carTitle)) {
        wishlist = wishlist.filter(title => title !== carTitle);
    } else {
        wishlist.push(carTitle);
    }
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
        const imageSrc = escapeHTML(car.image || '/static/placeholder.jpg');
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

    if (searchInput) searchInput.addEventListener("input", filterInventory);
    if (makeFilter) makeFilter.addEventListener("change", filterInventory);
    if (catFilter) catFilter.addEventListener("change", filterInventory);
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
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const wishlist = getWishlist();

    if (activeTab === 'sale') {
        const makeFilter = document.getElementById("filter-make") ? document.getElementById("filter-make").value : 'all';

        const saleVehicles = allVehicles.filter(v => {
            const isSale = v.type === 'sale';
            const matchesMake = makeFilter === 'all' || v.make === makeFilter;
            
            const matchesSearch = !searchQuery || 
                (v.title && v.title.toLowerCase().includes(searchQuery)) ||
                (v.make && v.make.toLowerCase().includes(searchQuery)) ||
                (v.specs && v.specs.toLowerCase().includes(searchQuery)) ||
                (v.year && v.year.toString().includes(searchQuery));

            return isSale && matchesMake && matchesSearch;
        });

        if (saleVehicles.length === 0) {
            grid.innerHTML = `<p class="no-results">No vehicles found matching your search.</p>`;
            return;
        }

        saleVehicles.forEach(car => {
            const isComparing = compareList.includes(car.title);
            const isWishlisted = wishlist.includes(car.title);
            const safeTitle = car.title ? car.title.replace(/\\/g, "\\\\").replace(/'/g, "\\'") : "";
            const encodedMsg = encodeURIComponent(`Hi, I want to buy the ${car.title || ''} ($${car.price ? Number(car.price).toLocaleString() : 'N/A'}) on DRIVE-NATION GLOBAL.`);
            const imageSrc = escapeHTML(car.image || '/static/placeholder.jpg');

            grid.innerHTML += `
                <div class="card">
                    <div class="card-image" style="background-image: url('${imageSrc}')" onclick="openLightbox('${imageSrc}')" title="Click to enlarge image">
                        <span class="badge">For Sale</span>
                        <button type="button" class="wishlist-toggle-btn ${isWishlisted ? 'active' : ''}" onclick="event.stopPropagation(); toggleWishlist('${escapeHTML(safeTitle)}');" title="${isWishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); border: none; border-radius: 50%; width: 34px; height: 34px; cursor: pointer; color: ${isWishlisted ? '#e63946' : '#fff'}; display: flex; align-items: center; justify-content: center; z-index: 2;">
                            <svg viewBox="0 0 24 24" width="18" height="18">
                                <path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                        </button>
                        <button type="button" class="compare-toggle-btn ${isComparing ? 'active' : ''}" onclick="event.stopPropagation(); toggleCompare('${escapeHTML(safeTitle)}');">
                            ${isComparing ? 'Selected for Compare' : '+ Compare'}
                        </button>
                        <div class="zoom-icon">Click to Enlarge</div>
                    </div>
                    <div class="card-body">
                        <h3 class="card-title">${escapeHTML(car.title)}</h3>
                        <p class="card-specs">${car.year ? escapeHTML(car.year) : ''} &bull; ${car.mileage ? Number(car.mileage).toLocaleString() + ' mi' : ''} &bull; ${escapeHTML(car.specs)}</p>
                    </div>
                    <div class="card-footer">
                        <div>
                            <span style="font-size: 0.7rem; color: var(--text-muted); display:block;">PRICE</span>
                            <span class="price-value">$${car.price ? Number(car.price).toLocaleString() : 'N/A'}</span>
                        </div>
                        <a href="https://wa.me/12272670270?text=${encodedMsg}" target="_blank" class="card-btn">Inquire on WhatsApp</a>
                    </div>
                </div>
            `;
        });
    } else {
        const catFilter = document.getElementById("filter-category") ? document.getElementById("filter-category").value : 'all';

        const rentVehicles = allVehicles.filter(v => {
            const isRent = v.type === 'rent';
            const matchesCategory = catFilter === 'all' || v.category === catFilter;

            const matchesSearch = !searchQuery || 
                (v.title && v.title.toLowerCase().includes(searchQuery)) ||
                (v.category && v.category.toLowerCase().includes(searchQuery)) ||
                (v.specs && v.specs.toLowerCase().includes(searchQuery));

            return isRent && matchesCategory && matchesSearch;
        });

        if (rentVehicles.length === 0) {
            grid.innerHTML = `<p class="no-results">No rentals found matching your search.</p>`;
            return;
        }

        rentVehicles.forEach(car => {
            const isComparing = compareList.includes(car.title);
            const isWishlisted = wishlist.includes(car.title);
            const safeTitle = car.title ? car.title.replace(/\\/g, "\\\\").replace(/'/g, "\\'") : "";
            const encodedMsg = encodeURIComponent(`Hi, I want to rent the ${car.title || ''} ($${car.dailyPrice || 0}/day) on DRIVE-NATION GLOBAL.`);
            const imageSrc = escapeHTML(car.image || '/static/placeholder.jpg');

            grid.innerHTML += `
                <div class="card">
                    <div class="card-image" style="background-image: url('${imageSrc}')" onclick="openLightbox('${imageSrc}')" title="Click to enlarge image">
                        <span class="badge">For Rent</span>
                        <button type="button" class="wishlist-toggle-btn ${isWishlisted ? 'active' : ''}" onclick="event.stopPropagation(); toggleWishlist('${escapeHTML(safeTitle)}');" title="${isWishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); border: none; border-radius: 50%; width: 34px; height: 34px; cursor: pointer; color: ${isWishlisted ? '#e63946' : '#fff'}; display: flex; align-items: center; justify-content: center; z-index: 2;">
                            <svg viewBox="0 0 24 24" width="18" height="18">
                                <path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                        </button>
                        <button type="button" class="compare-toggle-btn ${isComparing ? 'active' : ''}" onclick="event.stopPropagation(); toggleCompare('${escapeHTML(safeTitle)}');">
                            ${isComparing ? 'Selected for Compare' : '+ Compare'}
                        </button>
                        <div class="zoom-icon">Click to Enlarge</div>
                    </div>
                    <div class="card-body">
                        <h3 class="card-title">${escapeHTML(car.title)}</h3>
                        <p class="card-specs">${escapeHTML(car.category || 'Rental')} &bull; ${escapeHTML(car.specs)}</p>
                    </div>
                    <div class="card-footer">
                        <div>
                            <span style="font-size: 0.7rem; color: var(--text-muted); display:block;">RATE</span>
                            <span class="price-value">$${car.dailyPrice ? escapeHTML(car.dailyPrice) : '0'} <small style="font-size: 0.75rem;">/day</small></span>
                        </div>
                        <a href="https://wa.me/12272670270?text=${encodedMsg}" target="_blank" class="card-btn">Book on WhatsApp</a>
                    </div>
                </div>
            `;
        });
    }
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
    if (e.key === "Escape") closeLightbox();
});

function openAdminModal() { 
    const modal = document.getElementById("admin-modal") || document.getElementById("vehicle-modal");
    if (modal) modal.classList.add("active"); 
}

function closeAdminModal() { 
    const modal = document.getElementById("admin-modal") || document.getElementById("vehicle-modal");
    if (modal) modal.classList.remove("active"); 
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
    const type = typeInput.value;
    const formData = new FormData();

    formData.append("type", type);
    formData.append("title", document.getElementById("input-title")?.value || "");
    formData.append("specs", document.getElementById("input-specs")?.value || "");

    const imageInput = document.getElementById("input-image");
    if (imageInput && imageInput.files && imageInput.files[0]) {
        formData.append("image", imageInput.files[0]);
    } else if (imageInput && imageInput.value) {
        formData.append("image", imageInput.value);
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

    try {
        const response = await fetch('/api/cars', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            alert("Vehicle published successfully!");
            closeAdminModal();
            const form = document.getElementById("add-vehicle-form");
            if (form) form.reset();
            if (typeof fetchVehicles === 'function') fetchVehicles();
            if (typeof fetchAdminVehicles === 'function') fetchAdminVehicles();
        } else {
            alert("Failed to save vehicle.");
        }
    } catch (err) {
        console.error("Error saving vehicle:", err);
        alert("Failed to save vehicle.");
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
        const imageSrc = escapeHTML(car.image || '/static/placeholder.jpg');
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